---
name: coderabbit-configure
description: Creates or edits a .coderabbit.yaml configuration file for a repository. Use when the user asks to configure CodeRabbit, set up review rules, customize CodeRabbit behavior, generate a coderabbit config, or edit an existing .coderabbit.yaml.
---

# CodeRabbit Configure

Use this skill to create or update the `.coderabbit.yaml` configuration file that controls how CodeRabbit reviews the repository. Read the existing config if one is present, understand the user's goals, and write or patch the file with valid settings.

## Prerequisites

1. Confirm the working directory is inside a git repository.
2. Check whether a `.coderabbit.yaml` already exists in the repo root:

```bash
ls .coderabbit.yaml
```

If it exists, read it before making any changes. Do not overwrite settings the user did not ask to change.

## Workflow

### Step 1 — Understand the goal

Ask the user what behavior they want to configure if their request is ambiguous. Common goals include:

- Narrowing which paths or file types CodeRabbit reviews.
- Setting a review language or tone.
- Enabling or disabling specific rule categories (e.g. security, performance, style).
- Configuring the review trigger (e.g. on push, on PR, manually).
- Suppressing specific rules or paths from review.

Do not proceed with writing until the goal is clear.

### Step 2 — Draft the config

Write a `.coderabbit.yaml` that addresses the user's goal. Keep every setting explicit and commented when the effect is non-obvious.

Common top-level keys and their purpose:

```yaml
# Language for review comments (default: en-US)
language: en-US

# Review profile controls verbosity and focus
# Options: chill, assertive
reviews:
  profile: assertive

  # Request changes workflow: auto-request or comment only
  request_changes_workflow: false

  # High-level summary in each review
  high_level_summary: true

  # Poem in the review walkthrough (disable for professional repos)
  poem: false

  # Review status as a commit status check
  review_status: true

  # Collapse walkthrough details by default
  collapse_walkthrough: false

  # Auto-review settings
  auto_review:
    enabled: true
    # Only run on draft PRs if explicitly enabled
    drafts: false
    # Limit review to these base branches
    base_branches:
      - main
      - develop

  # Path filters: exclude paths from review
  path_filters:
    - "!dist/**"
    - "!**/node_modules/**"
    - "!**/*.lock"

  # Path instructions: per-path review focus
  path_instructions:
    - path: "**/*.ts"
      instructions: "Flag type safety issues and unsafe casts."
    - path: "**/*.sql"
      instructions: "Check for injection risks and missing indexes."

# Tools: enable or disable specific linters/analyzers
tools:
  github-checks:
    enabled: true
  ast-grep:
    enabled: false
```

Only include keys the user asked to configure. Do not add placeholder settings for features the user did not mention.

### Step 3 — Write the file

Write the config to `.coderabbit.yaml` in the repo root. If a file already exists, apply only the changes needed to satisfy the user's request and preserve all other settings.

### Step 4 — Confirm

After writing, read the file back and display the final contents to the user. Point out any setting that requires a CodeRabbit subscription tier or a specific CLI version to take effect, if known.

## Guardrails

- Do not overwrite an existing `.coderabbit.yaml` without reading it first.
- Do not add settings the user did not request.
- Do not invent configuration keys. Only use keys documented in the CodeRabbit configuration reference.
- If you are unsure whether a key is valid, say so and ask the user to verify against the CodeRabbit docs rather than writing an invalid config.
- Do not commit or push the file. Leave that to the user.