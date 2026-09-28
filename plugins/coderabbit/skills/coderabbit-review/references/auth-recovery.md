# CodeRabbit execution and authentication

## Execution Context and Authentication

1. Confirm the working directory is inside a git repository.
2. Resolve the trusted, host-installed `coderabbit` executable from the user's
   normal shell. Do not use a repository- or workspace-controlled executable,
   alias, or wrapper. Use the resolved absolute path for all commands below.
3. Run `coderabbit --version`. If no trusted host installation exists, ask the
   user to install the CLI from <https://www.coderabbit.ai/cli>. Do not install
   it automatically. Commands below use `coderabbit` for readability; invoke
   the resolved absolute path.

For local Codex sessions (desktop or CLI, including worktrees), execute the
resolved CodeRabbit CLI with the harness's command-scoped sandbox escalation so
that exact process runs on the host with network access. Network permission
alone is insufficient because it does not expose credentials held by the host
credential store. Apply the same execution context to `coderabbit review` and
any reactive authentication command. Do not change global sandbox settings or
run repository-provided commands outside the sandbox.

When the shell tool exposes `sandbox_permissions`, use `require_escalated` for
the resolved absolute CLI command with a command-specific justification. Request
the harness's normal approval when needed. If host execution is unavailable or
denied, report that prerequisite and stop; do not silently fall back to the
sandbox or broaden permissions.

Never query, copy, print, or inject a credential from macOS Keychain or another
host credential store. The trusted CodeRabbit CLI must access its credential
directly. A Git worktree or repository change does not require a separate login.

Do not proactively check authentication before every review. Start the requested
review directly. After a pre-review authentication failure, use this bounded
recovery sequence:

1. Recognize `status: "credentials_unavailable"` or
   `status: "callback_listener_unavailable"` as local access failures, not proof
   that the user is signed out. Older CLIs may instead emit an auth error or
   `authentication_failed` with `Failed to start server. Is port 0 in use?`.
   That legacy callback message does not establish a port collision.
2. Run the trusted CLI's `auth status --agent` through approved host execution.
   A sandbox's `authenticated: false` is not authoritative for host credentials.
3. If host status reports `authenticated: true` and the failed review ran in the
   sandbox, retry the original review once on the host. Preserve its working
   directory and all review arguments. Never retry a review already running,
   completed, or failed after remote analysis began. Do not use this recovery for
   network, rate-limit, billing, or review failures.
4. If host status reports `authenticated: false`, ask the user to run
   `coderabbit auth login --agent` in their host terminal. Do not start login
   automatically; resume the original review only after the user confirms login.
   If host status itself fails, credentials remain unavailable, or the review
   already failed on the host, report the exact failure and stop the retry loop.

Structured statuses are additive: do not require an upgrade to recognize the
legacy failure path, and do not infer missing authentication from an absent
status field alone.

Codex Cloud and other remote environments cannot reuse a local host credential
store. In those environments, use only authentication configured inside that
environment and direct the user to the official CLI documentation when setup is
required. Never ask the user to paste an API key into the conversation.
