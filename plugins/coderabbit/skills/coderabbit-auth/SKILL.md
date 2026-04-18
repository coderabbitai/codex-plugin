---
name: coderabbit-auth
description: Manages CodeRabbit CLI authentication and updates. Use when the user asks to log out of CodeRabbit, switch organizations, check which org is active, or update the CodeRabbit CLI.
---

# CodeRabbit Auth

Use this skill to manage the CodeRabbit CLI authentication lifecycle and keep the CLI up to date. It covers checking auth status, logging in, logging out, switching organizations, and updating the CLI.

## Auth Status

Check the current authentication state in agent mode:

```bash
coderabbit auth status --agent
```

The output identifies the authenticated user and the active organization. If the CLI reports the user is not authenticated, use the login flow in the [coderabbit-review](../coderabbit-review/SKILL.md) skill prerequisites.

## Logout

Sign out of the current CodeRabbit session:

```bash
coderabbit auth logout
```

After logout, any review or fix command will require re-authentication. Use `coderabbit auth login --agent` to sign in again.

Only run logout when the user explicitly asks to sign out or switch accounts. Do not log out as a troubleshooting step without confirming with the user first.

## Organization Management

List available organizations and switch the active one:

```bash
coderabbit auth org
```

Use this when:

- The user wants to review a repo under a different organization.
- Review output is scoped to the wrong org.
- The user asks which org is currently active.

After switching orgs, re-run `coderabbit auth status --agent` to confirm the active org changed before running any review commands.

## CLI Updates

Check the installed CLI version:

```bash
coderabbit --version
```

Update the CLI using the same package manager used for installation:

| Install method | Update command |
|----------------|----------------|
| npm (global) | `npm update -g coderabbit` |
| Homebrew | `brew upgrade coderabbit` |
| Manual binary | Download the latest release from the CodeRabbit releases page and replace the binary |

If the user is unsure how the CLI was installed, check whether `npm list -g coderabbit` or `brew list coderabbit` returns a result to identify the package manager.

Run `coderabbit --version` after updating to confirm the new version is active.

### When to suggest an update

- The CLI fails with an unrecognized flag or command error.
- Auth commands behave unexpectedly on a version older than what the current workflow requires.
- The user reports that review output does not match expected behavior and the CLI version is significantly behind the latest.

Do not run an update without first confirming with the user, as it may change CLI behavior for other workflows.

## Guardrails

- Do not log out the user unless explicitly asked.
- Do not switch organizations without confirming the target org with the user first.
- Do not run a package manager update command without the user's consent.
- If an auth operation fails, report the exact error and ask the user how to proceed rather than retrying silently.