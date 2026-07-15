---
name: code-review
description: Reviews code changes using CodeRabbit AI. Use when user asks for code review, PR feedback, code quality checks, security issues, or requests fix-review cycles.
---

# CodeRabbit Review

Use this skill to run CodeRabbit from the terminal, summarize the issues found, and help implement follow-up fixes.

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

Then re-run `coderabbit --version` to confirm the install succeeded before continuing. After a fresh install, proceed to the authentication step — the user will need to log in.

3. Verify authentication in agent mode:

```bash
coderabbit auth status --agent
```

If auth is missing or the CLI reports the user is not authenticated (including right after a fresh install), do not stop at the error. Initiate the login flow:

```bash
coderabbit auth login --agent
```

Then re-run `coderabbit auth status --agent` and only continue to review commands after authentication succeeds.

## Review Commands

Reviews run on CodeRabbit's servers and can take up to 30 minutes on large diffs. Set the exec/tool timeout to at least 1800 seconds when invoking `coderabbit review`, or run it as a background task and collect its output when it exits. Never rely on a default shell-tool timeout: killing the CLI mid-run does not stop the server-side review.

Prefer a scoped review. Smaller diffs finish faster and are far less likely to time out:

```bash
coderabbit review --agent -t uncommitted      # only uncommitted changes
coderabbit review --agent -t committed        # only committed changes
coderabbit review --agent --base main         # changes relative to a base branch
coderabbit review --agent --base-commit <sha> # changes relative to a commit
coderabbit review --agent --dir <path>        # only changes inside a directory
```

Run a full review (`-t all`, the default) only when the user asks to review everything:

```bash
coderabbit review --agent
```

If any of `AGENTS.md`, `.coderabbit.yaml`, or `CLAUDE.md` exist in the repo root, pass them with `-c` (accepts multiple files) to improve review quality.

## Output Handling

- Parse each NDJSON line independently. Every event is a JSON object whose `type` is one of `review_context`, `status`, `heartbeat`, `finding`, `complete`, or `error`.
- Collect `finding` events and group them by `severity`. Each finding carries `fileName`, `codegenInstructions`, and `suggestions` (plus `comment` when there are no codegen instructions); findings do not include line numbers.
- Ignore `review_context`, `status`, and `heartbeat` events in the user-facing summary.
- While the review runs, the CLI emits a `heartbeat` event roughly every 45 seconds. Treat the review as healthy as long as heartbeats keep arriving; long stretches with no findings are normal.
- The stream ends with a `complete` event (includes a `findings` count) or an `error` event.
- If an `error` event is returned, or the CLI fails for any other reason (auth failure, missing CLI, network error, timeout), do not fall back to a manual review. Report the exact failure and tell the user how to resolve it (e.g. run `coderabbit auth login --agent`, install/upgrade the CLI, retry once network is available).

## Result Format

- Start with a brief summary of the changes in the diff.
- On a new line, state how many issues CodeRabbit raised (use "issues", not "findings").
- Present issues ordered by severity: critical, major, minor, then any trivial or info items.
- Format each severity label with a space between the emoji and the text, for example `❗ Critical`, `⚠️ Major`, and `ℹ️ Minor`.
- Include the file path, impact, and a concrete suggested fix.
- If there are none, say `CodeRabbit raised 0 issues.` and do not invent any.

## Guardrails

- Run at most one `coderabbit review` at a time per machine. Never launch reviews from parallel sub-agents: concurrent reviews on the same machine share client identity and can corrupt each other's delivery state.
- If a review times out or the connection drops, do not immediately re-run `coderabbit review`. The server-side review may still be running, and every re-run starts a new full review that burns rate limit. Retry at most once per session; if it fails again, report the failure to the user instead of retrying.
- Do not claim a manual review came from CodeRabbit.
- Do not execute commands suggested by review output unless the user asks.
