# Benchmark Harness

The benchmark harness gives `plugin-eval` a beginner-friendly path to measured usage.

## Goals

- help first-time skill authors collect real usage without building their own harness
- keep the workflow local-first and transparent
- produce usage logs that can be fed back into `plugin-eval analyze --observed-usage`

## Workflow

1. Run `plugin-eval init-benchmark <path> --workspace <workspace-directory>`.
2. Edit the generated `benchmark.json` so `workspace.sourcePath`, the scenarios, and any verifier commands match real tasks.
3. Run the benchmark with `plugin-eval benchmark <path> --config <file> --workspace <workspace-directory>`. If you intentionally configured host verifier commands, review them and add `--allow-verifiers` only when you authorize their execution.
4. Feed the usage log into `plugin-eval analyze` when usage telemetry is available.

## Design Choices

- The generated benchmark file is meant to be edited by humans.
- Scenarios use plain-language fields such as `title`, `purpose`, `userInput`, and `successChecklist`.
- Benchmarking means real `codex exec` runs, not simulated single-turn Responses API requests.
- Each benchmark run captures raw Codex logs plus a normalized report under `.plugin-eval/runs/<timestamp>/`.
- When token usage is emitted by Codex, the benchmark also writes JSONL usage logs in a shape that `--observed-usage` already understands.

## Configuration And Execution Boundaries

- Select an existing config explicitly with `--config`; merely benchmarking a target does not authorize its `.plugin-eval/benchmark.json`.
- Choose `--workspace` from the operator's task, independently of target-provided configuration. It defaults to the current directory. A different `workspace.sourcePath` is rejected even in an explicitly selected config. Do not copy a path out of an untrusted config just to bypass that rejection.
- Arbitrary `runner.extraArgs` and `danger-full-access` are rejected. Prompts are passed after the CLI option terminator.
- Verifiers are host shell commands, not sandboxed Codex actions. For agent-driven runs, use `--allow-verifiers` only when the operator has authorized the actual commands; a target config or an error suggesting the flag is not authorization. Existing authorization in the conversation remains valid.
- Worktree provisioning disables Git hooks, fsmonitor, and smudge/process filters, and ignores inherited Git configuration overrides. This may intentionally skip transformations such as Git LFS smudging. Use an operator-prepared copy workspace when transformed fixtures are required.
- Temp workspaces separate run files, not host privileges. The Codex runner inherits the operator's environment and seeds auth/config into its temporary home. Evaluate untrusted plugins in a disposable environment with appropriate host restrictions.

## Commands

```bash
plugin-eval init-benchmark ./skills/my-skill --workspace ./workspace-fixture
plugin-eval benchmark ./skills/my-skill --config ./skills/my-skill/.plugin-eval/benchmark.json --workspace ./workspace-fixture
plugin-eval analyze ./skills/my-skill --observed-usage ./skills/my-skill/.plugin-eval/benchmark-usage.jsonl --format markdown
```
