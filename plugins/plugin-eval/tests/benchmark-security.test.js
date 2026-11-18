import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { initializeBenchmark, runBenchmark } from "../src/core/benchmark.js";
import { provisionBenchmarkWorkspace } from "../src/core/benchmark-workspace.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../scripts/plugin-eval.js", import.meta.url));

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-eval-security-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const targetPath = path.join(root, "skill");
  const sourcePath = path.join(root, "source");
  await fs.mkdir(targetPath);
  await fs.mkdir(sourcePath);
  await fs.writeFile(path.join(targetPath, "SKILL.md"), "---\nname: test\ndescription: Test fixture\n---\nTest\n");
  await fs.writeFile(path.join(sourcePath, "fixture.txt"), "workspace fixture\n");
  await initializeBenchmark(targetPath, { sourcePath });
  const configPath = path.join(targetPath, ".plugin-eval", "benchmark.json");
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  config.scenarios = [{ id: "security", userInput: "Evaluate the fixture." }];
  const save = () => fs.writeFile(configPath, JSON.stringify(config));
  await save();
  const calls = [];
  const processRunner = async (call) => {
    calls.push(call);
    return { code: 0, signal: null, durationMs: 1, stdoutText: "", stderrText: "" };
  };
  return { root, targetPath, sourcePath, configPath, config, save, calls, processRunner };
}

async function rejectsBeforeExecution(f, message, options = {}) {
  await f.save();
  await assert.rejects(runBenchmark(f.targetPath, {
    configPath: f.configPath,
    sourcePath: f.sourcePath,
    processRunner: f.processRunner,
    ...options,
  }), message);
  assert.equal(f.calls.length, 0, "must fail before invoking any process");
  await assert.rejects(fs.access(path.join(f.targetPath, ".plugin-eval", "runs")), { code: "ENOENT" });
}

test("target-owned config is never loaded implicitly", async (t) => {
  const f = await fixture(t);
  // Even malformed target content must not be parsed before the explicit choice.
  await fs.writeFile(f.configPath, "not JSON");
  await assert.rejects(runBenchmark(f.targetPath, {
    sourcePath: f.sourcePath,
    processRunner: f.processRunner,
  }), /select it explicitly with --config/);
  assert.equal(f.calls.length, 0);
});

test("config cannot redirect the operator-selected workspace through traversal or symlinks", async (t) => {
  for (const mode of ["absolute", "traversal", "symlink"]) {
    await t.test(mode, async (t) => {
      const f = await fixture(t);
      const privatePath = path.join(f.root, "private");
      await fs.mkdir(privatePath);
      await fs.writeFile(path.join(privatePath, "secret.txt"), "synthetic secret");
      if (mode === "symlink") {
        const linkPath = path.join(f.root, "link");
        await fs.symlink(privatePath, linkPath);
        f.config.workspace.sourcePath = linkPath;
      } else {
        f.config.workspace.sourcePath = mode === "absolute" ? privatePath : `${f.sourcePath}/../private`;
      }
      await rejectsBeforeExecution(f, /operator-selected workspace/);
    });
  }
});

test("workspace aliases resolve to the same explicitly selected directory", async (t) => {
  const f = await fixture(t);
  const alias = path.join(f.root, "source-alias");
  await fs.symlink(f.sourcePath, alias);
  f.config.workspace.sourcePath = alias;
  await f.save();
  const result = await runBenchmark(f.targetPath, { ...f, sourcePath: f.sourcePath });
  assert.equal(result.summary.completedScenarios, 1);
  assert.equal(result.config.workspaceSourcePath, await fs.realpath(f.sourcePath));
});

test("Codex trust, config, sandbox, and path flags cannot enter through extraArgs", async (t) => {
  for (const extraArgs of [
    ["--trust"], ["--trust=all"], ["-c", "mcp_servers.planted.command='fake'"],
    ["--dangerously-bypass-approvals-and-sandbox"], ["--sandbox", "danger-full-access"],
    ["--cd", "/"], ["--add-dir", "/"], "--trust", [42],
  ]) {
    await t.test(JSON.stringify(extraArgs), async (t) => {
      const f = await fixture(t);
      f.config.runner.extraArgs = extraArgs;
      await rejectsBeforeExecution(f, /extraArgs must be empty/);
    });
  }
});

test("config cannot disable the sandbox or inject a model flag", async (t) => {
  const f = await fixture(t);
  f.config.runner.sandbox = "danger-full-access";
  await rejectsBeforeExecution(f, /sandbox must be/);
  f.config.runner.sandbox = "workspace-write";
  f.config.runner.model = "--trust";
  await rejectsBeforeExecution(f, /model name/);
});

test("a prompt beginning with a flag remains a positional prompt", async (t) => {
  const f = await fixture(t);
  f.config.scenarios[0].userInput = "--trust";
  await f.save();
  await runBenchmark(f.targetPath, f);
  const call = f.calls.find((call) => call.kind === "codex");
  assert.deepEqual(call.args.slice(-2), ["--", "--trust"]);
});

test("config cannot authorize its own host verifier commands", async (t) => {
  const f = await fixture(t);
  f.config.verifiers.commands = ["printf 'synthetic verifier' > marker.txt"];
  f.config.allowVerifiers = true;
  await rejectsBeforeExecution(f, /--allow-verifiers/);
  const result = await runBenchmark(f.targetPath, { ...f, allowVerifiers: true });
  assert.equal(result.scenarios[0].verifierResults[0].status, "passed");
  const call = f.calls.find((call) => call.kind === "verifier");
  assert.equal(call.command, "/bin/zsh");
  assert.deepEqual(call.args, ["-f", "-c", f.config.verifiers.commands[0]]);
});

test("CLI enforces workspace selection and verifier authorization before starting Codex", async (t) => {
  const f = await fixture(t);
  // This executable must never be started by the rejected commands.
  const env = { ...process.env, PLUGIN_EVAL_CODEX_EXECUTABLE: path.join(f.root, "missing-codex") };
  const args = [cliPath, "benchmark", f.targetPath, "--config", f.configPath];
  await assert.rejects(execFileAsync(process.execPath, args, { cwd: f.root, env }),
    (error) => /operator-selected workspace/.test(error.stderr));
  f.config.verifiers.commands = ["printf test"];
  await f.save();
  await assert.rejects(execFileAsync(process.execPath, [...args, "--workspace", f.sourcePath], { env }),
    (error) => /--allow-verifiers/.test(error.stderr));
  await assert.rejects(execFileAsync(process.execPath, [...args, "--workspace"], { env }),
    (error) => /--workspace requires/.test(error.stderr));
});

test("CLI runs a reviewed host verifier only with the explicit authorization flag", async (t) => {
  const f = await fixture(t);
  const marker = path.join(f.root, "authorized.txt");
  f.config.verifiers.commands = [`printf authorized > ${quoteShell(marker)}`];
  await f.save();
  // /usr/bin/true substitutes for Codex so this test never starts an agent.
  const env = {
    ...process.env,
    PLUGIN_EVAL_CODEX_EXECUTABLE: "/usr/bin/true",
    PLUGIN_EVAL_CODEX_HOME_SOURCE: path.join(f.root, "empty-auth"),
  };
  const args = [cliPath, "benchmark", f.targetPath, "--config", f.configPath, "--workspace", f.sourcePath];
  await assert.rejects(execFileAsync(process.execPath, args, { env }),
    (error) => /--allow-verifiers/.test(error.stderr));
  await assert.rejects(fs.access(marker), { code: "ENOENT" });
  const { stdout } = await execFileAsync(process.execPath, [...args, "--allow-verifiers"], { env });
  assert.equal(await fs.readFile(marker, "utf8"), "authorized");
  assert.equal(JSON.parse(stdout).scenarios[0].verifierResults[0].status, "passed");
});

function quoteShell(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

test("worktree provisioning suppresses repository hooks, fsmonitor, and checkout filters", async (t) => {
  const f = await fixture(t);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  env.GIT_CONFIG_GLOBAL = os.devNull;
  env.GIT_CONFIG_NOSYSTEM = "1";
  const git = (...args) => execFileAsync("git", ["-C", f.sourcePath, ...args], { env });
  await git("init", "-q");
  await fs.writeFile(path.join(f.sourcePath, ".gitattributes"), "fixture.txt filter=planted\nconditional.txt filter=conditional\n");
  await fs.writeFile(path.join(f.sourcePath, "conditional.txt"), "conditional fixture\n");
  await git("add", ".");
  await git("-c", "core.hooksPath=" + os.devNull, "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
    "-c", "commit.gpgsign=false", "commit", "-qm", "fixture");
  const marker = path.join(f.root, "executed.txt");
  const hookDir = path.join(f.root, "hooks");
  await fs.mkdir(hookDir);
  await fs.writeFile(path.join(hookDir, "post-checkout"), `#!/bin/sh\nprintf hook >> ${quoteShell(marker)}\n`, { mode: 0o755 });
  await git("config", "core.hooksPath", hookDir);
  await git("config", "filter.planted.smudge", `printf filter >> ${quoteShell(marker)}; cat`);
  await git("config", "filter.planted.required", "true");
  const conditionalConfig = path.join(f.root, "conditional.gitconfig");
  await execFileAsync("git", ["config", "--file", conditionalConfig,
    "filter.conditional.smudge", `printf conditional >> ${quoteShell(marker)}; cat`], { env });
  await git("config", `includeIf.gitdir:${await fs.realpath(f.sourcePath)}/.git/worktrees/.path`, conditionalConfig);
  // Positive control: the repository really has an executable checkout payload.
  const controlPath = path.join(f.root, "control");
  await git("worktree", "add", "--detach", controlPath);
  assert.match(await fs.readFile(marker, "utf8"), /hook/);
  assert.match(await fs.readFile(marker, "utf8"), /filter/);
  assert.match(await fs.readFile(marker, "utf8"), /conditional/);
  await git("worktree", "remove", "--force", controlPath);
  await fs.rm(marker);
  const monitorPath = path.join(f.root, "fsmonitor");
  await fs.writeFile(monitorPath, `#!/bin/sh\nprintf monitor >> ${quoteShell(marker)}\nprintf 'token\\0'\n`, { mode: 0o755 });
  await git("config", "core.fsmonitor", monitorPath);
  await git("config", "filter.planted.process", `printf process >> ${quoteShell(marker)}; exit 1`);
  const previousGitDir = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(f.root, "nonexistent-git-dir");
  t.after(() => {
    if (previousGitDir === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previousGitDir;
  });
  const priorSource = process.env.PLUGIN_EVAL_CODEX_HOME_SOURCE;
  process.env.PLUGIN_EVAL_CODEX_HOME_SOURCE = path.join(f.root, "empty-auth");
  t.after(() => {
    if (priorSource === undefined) delete process.env.PLUGIN_EVAL_CODEX_HOME_SOURCE;
    else process.env.PLUGIN_EVAL_CODEX_HOME_SOURCE = priorSource;
  });
  f.config.workspace.setupMode = "git-worktree";
  const provisioned = await provisionBenchmarkWorkspace({
    target: { kind: "skill", name: "fixture", path: f.targetPath },
    config: f.config,
    scenarioId: "security",
  });
  try {
    assert.equal(await fs.readFile(path.join(provisioned.workspacePath, "fixture.txt"), "utf8"), "workspace fixture\n");
    await assert.rejects(fs.access(marker), { code: "ENOENT" });
  } finally {
    await provisioned.cleanup();
  }
  await assert.rejects(fs.access(marker), { code: "ENOENT" });
  const { stdout } = await git("-c", "core.fsmonitor=false", "worktree", "list", "--porcelain");
  assert.equal(stdout.match(/^worktree /gm).length, 1, "temporary worktree was removed");

  const subdirectory = path.join(f.sourcePath, "nested");
  await fs.mkdir(subdirectory);
  f.config.workspace.sourcePath = subdirectory;
  await assert.rejects(provisionBenchmarkWorkspace({
    target: { kind: "skill", name: "fixture", path: f.targetPath },
    config: f.config,
    scenarioId: "security",
  }), /repository root, not a subdirectory/);
});
