# CodeRabbit Codex review friction ledger

Track one behavioral change per version, its originating evidence, and what the
next run actually demonstrates. All runs below occurred on 2026-09-30. These are
local source tests, not evidence of marketplace publication.

## Loop

1. Identify a friction in the transcript. Keep the agent's self-critique separate
   from verified behavior.
2. Change one supported behavior, bump the version, and record the exact parent
   and tested commit. Keep unrelated fixes out of the diff.
3. Start a fresh Codex session with that skill and the same review request, then
   resume it with the same friction question. Do not supply the prior diagnosis.
4. Record observed improvement, new observations, blocked or unexercised paths,
   and remaining uncertainty. A new observation is not proof of a new regression.

## Version record

| Version | Source and base | Behavioral change | Observed result | What this establishes |
| --- | --- | --- | --- | --- |
| 1.1.4 | Installed plugin; publishing commit unknown | Original session baseline | CLI absent from PATH but present at its default path; binary exited 137. After user reinstallation, sandbox auth failed, host auth succeeded, and review completed with zero issues on two tracked files. | Setup and auth friction observed. Cause of exit 137 unknown. Not a controlled fresh-session comparison. |
| 1.1.5 | `161764c0`; existing changes in [#10](https://github.com/coderabbitai/codex-plugin/pull/10) and [#12](https://github.com/coderabbitai/codex-plugin/pull/12) | Existing discovery, host execution, scope, and reporting guidance; no new patch in this loop | Found CLI, disclosed untracked exclusion, requested review without proactive auth check. Approval rejected reusable permission and instruction-file payload. No review ran. | Some setup behavior improved. Approval boundary blocked completion. Multiple pre-existing changes prevent attributing each improvement to one version edit. |
| 1.1.6 | `385dd4a8`, based on `161764c0`; [#16](https://github.com/coderabbitai/codex-plugin/pull/16) | Omit `prefix_rule` by default; propose a reusable rule only when the user requests future runs | One-time host request accepted. Same instruction-file payload; review completed with zero findings on two tracked files. Agent raised a policy concern in commentary and omitted it from the final answer. | Approval-default behavior exercised successfully once. Reliability not established; final-answer concern left open. |
| 1.1.7, attempt 1 | `e42d8cdf`, based on `385dd4a8`; [#17](https://github.com/coderabbitai/codex-plugin/pull/17), stacked on #16 | Final answer must resolve or explicitly leave unresolved concerns raised in commentary, separately from CodeRabbit findings | Request omitted `prefix_rule`, but approval rejected the unchanged instruction-file payload. No review ran and no preliminary review concern was raised. Same friction question asked afterward. | 1.1.6 approval default retained. New reporting rule unexercised. Payload blocker recurred; not established as a regression introduced by 1.1.7. |
| 1.1.7, attempt 2 | Same `e42d8cdf`; user-requested retry, no skill change | None; same runner, tracked diff, and prompts as attempt 1 | One-time host request accepted; same instruction-file payload. Review completed in about 211 seconds with zero findings on two tracked files. Free-tier notice retained in final answer; no preliminary correctness concern raised. | Confirms a successful unchanged retry, not a new version fix. Approval outcome varied. The original missing-concern regression remains unexercised. |

## Friction trace

| ID | First observed | Origin or evidence | Addressed by / current state |
| --- | --- | --- | --- |
| F01 | 1.1.4 | Installed skill's PATH-only discovery and proactive auth sequence; sandbox hid saved credentials | 1.1.5 found the fallback path and requested host review directly. Broken-installation recovery remains untested. |
| F02 | 1.1.5 | `references/auth-recovery.md` required proposing a reusable subcommand prefix for ordinary reviews | 1.1.6 changed the default. Both 1.1.6 and 1.1.7 omitted the prefix. The explicit request for a reusable rule has not been tested in this loop. |
| F03 | 1.1.5 | `SKILL.md` requests relevant instruction files with `-c`; approval questioned transmission of their full contents | Payload accepted in 1.1.6, rejected in 1.1.7 attempt 1, and accepted in unchanged attempt 2. Open. Variable model-generated justifications and approval decisions prevent a causal claim about the version change. |
| F04 | 1.1.6 | Agent commentary raised a policy concern; final answer reported zero CodeRabbit findings without addressing it | 1.1.7 adds a closing-summary rule in `references/review-output.md`. Behavioral verification pending: attempt 1 stopped before review; attempt 2 completed without raising a preliminary correctness concern. |
| F05 | 1.1.5 onward | Repeated setup/tool calls in transcripts; all follow-up critiques mention preparation overhead | Open; no optimization or performance claim yet. |
| F06 | 1.1.4, 1.1.6 | Completed runs reported free-tier use and zero findings; output did not establish review depth | Open. Do not infer depth or an independent clean assessment from the issue count. |

Attempt 2 received the same friction question. Its self-critique again raised
preparation/polling overhead and a low-value final answer; these are suggestions,
not additional fixes. A Python syntax error in a generated preparation command
is visible in the transcript and was corrected in that run; attribution to the
1.1.7 reporting change is not established.

No newly introduced regression has been causally established by these runs.
The recurring payload rejection shows that one accepted review does not prove
the approval path is reliable. Do not silently add a payload-policy change to
the 1.1.7 reporting patch.

## Reproduction and evidence

For 1.1.5 through 1.1.7:

- Codex CLI 0.153.4, configured model `gpt-6-astra`, CodeRabbit CLI 0.8.2.
- Fresh `codex exec` session with workspace-write sandboxing and automatic
  approval review; exact source skill supplied by path. No prior conversation
  or friction list supplied. This does not test marketplace installation.
- Same runner and tracked diff; SHA-256 of the tracked diff:
  `e620d2b6e142ebb77ae64186d87495ff72fa59c088f82cff81f2f01382d4344b`.
- Initial request: "Review my current changes and provide feedback", preceded
  only by the version-specific skill path.
- Follow-up: "this don't feel like a good flow when using coderabbit right,
  what was wrong, what did you not like, let's make a friction list,".
- Generated review command in each run:
  `coderabbit review --agent -c AGENTS.md CLAUDE.md` using the trusted absolute
  CLI path. Approval arguments and justifications were model-generated.
- One run each for 1.1.5 and 1.1.6; two runs of unchanged 1.1.7. CLI checkpoints,
  service state, and approval decisions are not frozen; elapsed time is not a controlled performance benchmark.
- Local evidence bundles: `coderabbit-115-fresh-20260930`,
  `coderabbit-116-fresh-20260930`, `coderabbit-117-fresh-20260930`, and
  `coderabbit-117-retry2-20260930`.
  They retain exact prompts, source snapshots, invocations, raw events, final
  answers, and exit/duration records. 1.1.6 and 1.1.7 also retain extracted
  approval-call arguments. Raw transcripts contain workspace content and are
  not committed to this public repository.
- Working-tree changes were checked after the 1.1.6 and 1.1.7 runs: unchanged.

The follow-up agent's proposed remedies are hypotheses, not authorization or
verified root causes. In particular, a recommendation to change payload consent
does not override an approval rejection.
