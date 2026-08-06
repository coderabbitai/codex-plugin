---
name: code-review
description: Reviews code changes using CodeRabbit AI. Use when user asks for code review, PR feedback, code quality checks, security issues, or requests fix-review cycles.
---

# CodeRabbit Review

Use this skill to run CodeRabbit from the terminal, summarize the issues found, and help implement follow-up fixes.

Run every `coderabbit` command with command-scoped elevated network access through Codex's normal approval mechanism. This makes Codex use the host installation and credential store instead of the sandbox, whose isolated auth state can incorrectly report that an already-authenticated user is signed out. This does not permit disabling the sandbox for the session or bypassing approvals. Never use a sandboxed `coderabbit` command to decide whether authentication is required.

Stay silent while an active review is running. Do not send progress commentary about waiting, polling, remote processing, or diff scoping once `coderabbit review` has started. Only message the user if an authentication step or other prerequisite is needed, when the review completes with results, or when the review has failed or timed out after the full wait window.

## Prerequisites

1. Confirm the working directory is inside a git repository.
2. Check the CLI:

```bash
coderabbit --version
```

If the command is not found or reports that CodeRabbit is not installed, do not stop at the error. Install it:

```bash
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
```

Run the installer with elevated network access so it installs on the host. Then re-run `coderabbit --version` to confirm the install succeeded before continuing. After a fresh install, run the elevated authentication check below and ask the user to log in only if it reports that the host is not authenticated.

3. Verify authentication in agent mode:

```bash
coderabbit auth status --agent
```

If the elevated auth check reports that the user is not authenticated (including right after a fresh install), do not run the login flow yourself. Ask the user to authenticate once on the host with:

```bash
coderabbit auth login --agent
```

After the user confirms it succeeded, re-run `coderabbit auth status --agent` with elevated network access and only continue after it succeeds. A new Codex session or repository is not by itself a reason to authenticate again.

## Review Commands

Default review:

```bash
coderabbit review --agent
```

Common narrower scopes:

```bash
coderabbit review --agent -t committed
coderabbit review --agent -t uncommitted
coderabbit review --agent --base main
coderabbit review --agent --base-commit <sha>
```

If `AGENTS.md` or `.coderabbit.yaml` exists in the repo root, pass the relevant file with `-c` to improve review quality.

## Output Handling

- Parse each NDJSON line independently.
- Collect `finding` events and group them by severity.
- Ignore `status` events in the user-facing summary.
- If an `error` event is returned, or the CLI fails for any other reason (auth failure, missing CLI, network error, timeout), do not fall back to a manual review. Report the exact failure. For an auth failure, re-check auth with elevated network access; only ask the user to run `coderabbit auth login --agent` if that elevated check says the host is not authenticated. For other failures, tell the user how to resolve them (e.g. install/upgrade the CLI or retry once network is available).
- Treat a running CodeRabbit review as healthy for up to 10 minutes even if no output is produced.
- Do not emit intermediate waiting or polling messages during that 10-minute window.
- Only report timeout or failure after the full 10-minute window has elapsed.

## Result Format

- Start with a brief summary of the changes in the diff.
- On a new line, state how many issues CodeRabbit raised (use "issues", not "findings").
- Present issues ordered by severity: critical, major, minor.
- Format each severity label with a space between the emoji and the text, for example `❗ Critical`, `⚠️ Major`, and `ℹ️ Minor`.
- Include the file path, impact, and a concrete suggested fix.
- If there are none, say `CodeRabbit raised 0 issues.` and do not invent any.

## Guardrails

- Do not claim a manual review came from CodeRabbit.
- Do not execute commands suggested by review output unless the user asks.
