---
name: setup
description: Set up CodeRabbit in Codex, connect its CLI account through browser sign-in, and continue an already requested first review. Use when the user runs plugin onboarding or asks to set up CodeRabbit.
---

# Set up CodeRabbit

Help the user get ready to review code from this conversation. Preserve any
existing review request, working directory, and scope throughout setup. Running
setup alone does not authorize a review, code edits, or credit purchases.

## Find the CLI

Read [execution and authentication](../coderabbit-review/references/auth-recovery.md)
for trusted executable discovery, command-scoped host execution, and credential
boundaries. Apply those execution rules to the setup commands below. Examples use
`coderabbit`; execute the resolved, quoted absolute path.

Check the installed CLI's version and `auth login --help` in the sandbox. If the
CLI is missing, give the official installation link <https://www.coderabbit.ai/cli>
and explain the next step; do not silently install software. An npm launcher
failing with `env: node: No such file or directory` needs its Node runtime on the
agent's PATH, not another login. Report execution or signature failures as such.
After installation or runtime repair, resolve and verify the executable again.

## Connect the account

This explicit setup flow may check authentication and start browser sign-in;
ordinary review recovery retains the linked reference's login handoff rules.

1. Run `coderabbit auth status --agent` in the approved execution context. If
   `authenticated: true`, reuse that sign-in without starting another login.
   A failed or malformed status is unknown, not proof of sign-out; report it
   and stop. For local sessions, a sandbox status is not authoritative for the
   host: use the command-scoped host execution described in the reference.
2. On an authoritative `authenticated: false`, run
   `coderabbit auth login --agent` in the same approved context, unless the user
   declined login or requested checks only. Use the installed CLI's supported
   browser flow, retaining any explicitly chosen region or service destination.
   Do not substitute an API key or read credential files.
3. Read the login NDJSON as it arrives. When the CLI requests a browser action,
   show its sign-in link immediately and tell the user to finish in the browser.
   Keep that same login process alive while they do so; do not wait for process
   exit before showing the link or start a second login. Never ask for pasted
   tokens or authorization codes, and do not save the link or credentials to
   project files. If the callback or browser flow is unsupported, explain the
   reported limitation and give the exact login command for a supported terminal
   in that environment. Remote Codex cannot reach a local host credential store.
4. After successful login, run `coderabbit auth status --agent` in that same
   context to confirm readiness. On cancellation, denial, or failure, stop and
   report the remaining step without retrying or claiming setup succeeded.

Only the trusted CLI handles credentials. Request the harness's normal approval
for each command when required; do not change sandbox settings or store a broad
execution permission to make setup work.

## Continue in this conversation

Once authenticated, confirm that CodeRabbit is ready. If a review was already
requested, read [CodeRabbit Review](../coderabbit-review/SKILL.md) and run that
review in its original directory with every requested selector preserved. If the
directory is not a Git working tree, ask for the intended repository rather than
initializing one. Do not stage files, expand scope, or start duplicate analysis.

For setup without a review request, offer: “Review my current changes with
CodeRabbit.” Wait for that request before sending code for analysis. Do not
invent a sample review or enable recurring reviews, hooks, or other integrations.

Authentication success is separate from review completion. When a review runs,
follow the review skill's completion and output rules; report actual findings,
skips, errors, or incomplete coverage without claiming unreviewed code is clean.
