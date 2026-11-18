import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { isProbablyTextFile, isDirectory, readText, relativePath } from "../lib/files.js";

const execFileAsync = promisify(execFile);

async function runWorkspaceGit(sourcePath, args) {
  // Repository operations must not inherit caller-supplied Git config overrides
  // or execute hooks/fsmonitor programs from the repository being evaluated.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = os.devNull;
  return execFileAsync("git", [
    "-c", `core.hooksPath=${os.devNull}`,
    "-c", "core.fsmonitor=false",
    "-C", sourcePath,
    ...args,
  ], { env });
}

const SNAPSHOT_IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  ".tmp",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".plugin-eval",
]);

function testFilePattern(filePath) {
  return /(^|\/)(tests?|__tests__)\/|(\.test|\.spec)\.|(^|\/)test_[^/]+\.py$/.test(filePath);
}

async function copyDirectory(sourcePath, destinationPath) {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.cp(sourcePath, destinationPath, { recursive: true });
}

async function copyIfExists(sourcePath, destinationPath) {
  try {
    await fs.access(sourcePath);
  } catch {
    return false;
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
  return true;
}

async function resolveGitRoot(sourcePath) {
  const { stdout } = await runWorkspaceGit(sourcePath, ["rev-parse", "--show-toplevel"]);
  return stdout.trim();
}

async function createWorkspaceCopy(sourcePath, workspacePath) {
  await copyDirectory(sourcePath, workspacePath);
  return {
    workspacePath,
    cleanup: async () => {
      await fs.rm(workspacePath, { recursive: true, force: true });
    },
  };
}

async function createWorkspaceFromGitWorktree(sourcePath, workspacePath) {
  const repoRoot = await resolveGitRoot(sourcePath);
  if (await fs.realpath(repoRoot) !== await fs.realpath(sourcePath)) {
    throw new Error("git-worktree requires --workspace to select the repository root, not a subdirectory.");
  }
  // Create metadata first so conditional includes are evaluated in the NEW
  // worktree, where checkout will occur, before disabling executable filters.
  await runWorkspaceGit(repoRoot, ["worktree", "add", "--detach", "--no-checkout", workspacePath]);
  try {
    let filterKeys = [];
    try {
      const { stdout } = await runWorkspaceGit(workspacePath, [
        "config", "--null", "--name-only", "--get-regexp", "^filter\\..*\\.(smudge|process|required)$",
      ]);
      filterKeys = stdout.split("\0").filter(Boolean);
    } catch (error) {
      if (error.code !== 1) {
        throw error;
      }
    }
    const filterOverrides = filterKeys.flatMap((key) => ["-c", `${key}=${key.endsWith(".required") ? "false" : ""}`]);
    await runWorkspaceGit(workspacePath, [...filterOverrides, "reset", "--hard", "--no-recurse-submodules", "HEAD"]);
  } catch (error) {
    await runWorkspaceGit(repoRoot, ["worktree", "remove", "--force", workspacePath]);
    throw error;
  }
  return {
    workspacePath,
    cleanup: async () => {
      await runWorkspaceGit(repoRoot, ["worktree", "remove", "--force", workspacePath]);
    },
  };
}

async function provisionSkillInstall(target, codexHomePath) {
  const skillPath = path.join(codexHomePath, "skills", target.name);
  await copyDirectory(target.path, skillPath);
  return skillPath;
}

async function provisionPluginInstall(target, workspacePath) {
  const pluginsRoot = path.join(workspacePath, "plugins");
  const installPath = path.join(pluginsRoot, target.name);
  await copyDirectory(target.path, installPath);

  const marketplacePath = path.join(workspacePath, ".agents", "plugins", "marketplace.json");
  const marketplace = {
    name: "plugin-eval-benchmark",
    interface: {
      displayName: "Plugin Eval Benchmark",
    },
    plugins: [
      {
        name: target.name,
        source: {
          source: "local",
          path: `./plugins/${target.name}`,
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL",
        },
        category: "Coding",
      },
    ],
  };

  await fs.mkdir(path.dirname(marketplacePath), { recursive: true });
  await fs.writeFile(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");
  return installPath;
}

async function seedCodexHome(codexHomePath) {
  const sourceCodexHome = process.env.PLUGIN_EVAL_CODEX_HOME_SOURCE
    ? path.resolve(process.env.PLUGIN_EVAL_CODEX_HOME_SOURCE)
    : path.join(os.homedir(), ".codex");

  await fs.mkdir(codexHomePath, { recursive: true });
  await Promise.all([
    copyIfExists(path.join(sourceCodexHome, "auth.json"), path.join(codexHomePath, "auth.json")),
    copyIfExists(path.join(sourceCodexHome, "config.toml"), path.join(codexHomePath, "config.toml")),
  ]);
}

export function defaultTargetProvisioningMode(target) {
  if (target.kind === "skill") {
    return "isolated-skill-home";
  }
  if (target.kind === "plugin") {
    return "workspace-plugin-marketplace";
  }
  throw new Error("Benchmarking only supports Codex skills and plugins.");
}

export async function provisionBenchmarkWorkspace({ target, config, scenarioId }) {
  const sourcePath = path.resolve(config.workspace.sourcePath);
  if (!(await isDirectory(sourcePath))) {
    throw new Error(`Benchmark workspace.sourcePath must be a directory: ${sourcePath}`);
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `plugin-eval-${scenarioId}-`));
  const workspacePath = path.join(tempRoot, "workspace");
  const homePath = path.join(tempRoot, "home");
  const codexHomePath = path.join(homePath, ".codex");
  const setupMode = config.workspace.setupMode || "copy";

  let workspace;
  let installedTargetPath = null;
  try {
    workspace = setupMode === "git-worktree"
      ? await createWorkspaceFromGitWorktree(sourcePath, workspacePath)
      : await createWorkspaceCopy(sourcePath, workspacePath);
    await seedCodexHome(codexHomePath);

    if (config.targetProvisioning.mode === "isolated-skill-home") {
      installedTargetPath = await provisionSkillInstall(target, codexHomePath);
    } else if (config.targetProvisioning.mode === "workspace-plugin-marketplace") {
      installedTargetPath = await provisionPluginInstall(target, workspacePath);
    } else {
      throw new Error(`Unsupported target provisioning mode: ${config.targetProvisioning.mode}`);
    }
  } catch (error) {
    try {
      await workspace?.cleanup();
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
    throw error;
  }

  return {
    tempRoot,
    workspacePath,
    homePath,
    codexHomePath,
    installedTargetPath,
    setupMode,
    cleanup: async () => {
      await workspace.cleanup();
      await fs.rm(tempRoot, { recursive: true, force: true });
    },
  };
}

async function hashFile(filePath) {
  const hash = createHash("sha1");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

async function visitSnapshot(rootPath, currentPath, entries) {
  const directoryEntries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of directoryEntries) {
    const entryPath = path.join(currentPath, entry.name);
    const relativeEntryPath = relativePath(rootPath, entryPath);

    if (entry.isDirectory()) {
      if (SNAPSHOT_IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      await visitSnapshot(rootPath, entryPath, entries);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = await fs.stat(entryPath);
    const isText = isProbablyTextFile(entryPath);
    const text = isText ? await readText(entryPath) : null;

    entries.set(relativeEntryPath, {
      path: relativeEntryPath,
      absolutePath: entryPath,
      size: stats.size,
      hash: await hashFile(entryPath),
      isText,
      lineCount: text === null ? null : text.replace(/\r\n/g, "\n").split("\n").length,
    });
  }
}

export async function snapshotWorkspace(rootPath) {
  const entries = new Map();
  await visitSnapshot(rootPath, rootPath, entries);
  return entries;
}

export function diffWorkspaceSnapshots(beforeSnapshot, afterSnapshot) {
  const added = [];
  const modified = [];
  const deleted = [];

  for (const [filePath, afterEntry] of afterSnapshot.entries()) {
    const beforeEntry = beforeSnapshot.get(filePath);
    if (!beforeEntry) {
      added.push({
        path: filePath,
        status: "added",
        isText: afterEntry.isText,
        lineCountBefore: 0,
        lineCountAfter: afterEntry.lineCount,
        lineDelta: typeof afterEntry.lineCount === "number" ? afterEntry.lineCount : null,
      });
      continue;
    }

    if (beforeEntry.hash !== afterEntry.hash) {
      modified.push({
        path: filePath,
        status: "modified",
        isText: afterEntry.isText || beforeEntry.isText,
        lineCountBefore: beforeEntry.lineCount,
        lineCountAfter: afterEntry.lineCount,
        lineDelta:
          typeof beforeEntry.lineCount === "number" && typeof afterEntry.lineCount === "number"
            ? afterEntry.lineCount - beforeEntry.lineCount
            : null,
      });
    }
  }

  for (const [filePath, beforeEntry] of beforeSnapshot.entries()) {
    if (!afterSnapshot.has(filePath)) {
      deleted.push({
        path: filePath,
        status: "deleted",
        isText: beforeEntry.isText,
        lineCountBefore: beforeEntry.lineCount,
        lineCountAfter: 0,
        lineDelta: typeof beforeEntry.lineCount === "number" ? -beforeEntry.lineCount : null,
      });
    }
  }

  return {
    added: added.sort((a, b) => a.path.localeCompare(b.path)),
    modified: modified.sort((a, b) => a.path.localeCompare(b.path)),
    deleted: deleted.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export function summarizeWorkspaceDiff(diff) {
  const changedFiles = [...diff.added, ...diff.modified];
  return {
    addedFileCount: diff.added.length,
    modifiedFileCount: diff.modified.length,
    deletedFileCount: diff.deleted.length,
    changedFileCount: changedFiles.length,
    generatedFileCount: diff.added.length,
    generatedTestFileCount: diff.added.filter((entry) => testFilePattern(entry.path)).length,
    changedTestFileCount: changedFiles.filter((entry) => testFilePattern(entry.path)).length,
    changedTextLineDelta: changedFiles.reduce((sum, entry) => sum + (entry.lineDelta || 0), 0),
    changedFiles,
    allChanges: [...diff.added, ...diff.modified, ...diff.deleted],
  };
}
