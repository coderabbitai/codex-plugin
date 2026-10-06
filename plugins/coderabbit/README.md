# CodeRabbit review reminder

The plugin includes an optional `Stop` hook for Codex versions with plugin-hook
support. With Python 3 and Git on `PATH`, start a session with:

```sh
CODERABBIT_REVIEW_REMINDER=1 codex
```

Review and trust the bundled hook through `/hooks` (or the app's hook review UI).
For the desktop app, the environment variable must be present in the app's
environment before it starts. Unset it or set it to `0` to disable the reminder.

When tracked staged or unstaged changes exist, the hook gives the agent one
reminder to use the CodeRabbit code-review skill if this task still needs an
authorized review. It does not run the CLI, upload code, or grant permission for
review, authentication, spending, or fixes. The agent may finish immediately
when review is already done, unrelated, unavailable, or not authorized.

This is a stateless reminder, not a review gate: it does not know who made the
changes or whether they were reviewed. It can remind again on a later user
turn. It skips hook continuations, plan mode, clean/non-Git directories, raw
untracked files, submodule-only changes, and changes already committed.

The hook uses `CLAUDE_PLUGIN_ROOT`, which Codex supplies for compatibility, so
the command and script can also be used by the Claude Code plugin.

Validation: `python3 plugins/coderabbit/hooks/test_review_reminder.py` from the
repository root.
