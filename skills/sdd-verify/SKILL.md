---
name: sdd-verify
description: SDD phase 4 (verify). Verifies the implementation against the spec with Superpowers, runs code review, and handles the development branch. Invoked by the sdd orchestrator; do not call directly unless resuming the verify phase.
---

# SDD Phase 4 — Verify (OpenSpec + Superpowers)

Confirm the change actually works and matches the spec, then handle the branch.

## Step 0 — Entry check

Read `openspec/changes/<name>/.sdd-state.yaml`. Confirm `phase: verify`.
Read the proposal, design doc, and plan as context. Use the plan's `base-ref` to
scope the change:

```bash
git diff --stat <base-ref>...HEAD
```

## Step 1 — Decide verification depth

Count the change size. **Full** verification if any of: tasks > 3, delta spec
capabilities > 1, or changed files > 4. Otherwise **lightweight**.

## Step 2 — Verify

**Immediately execute:** Use `/skill:verification-before-completion`. Skipping is
prohibited.

### Lightweight

Check correctness, security, and edge cases. Use
`/skill:requesting-code-review` for a light review limited to those three.
Skip: spec scenario coverage, deep design-doc consistency, style-only
suggestions.

### Full

Everything in lightweight, plus: spec scenario coverage, design-doc consistency,
and drift detection between the delta spec and the implementation. Validate the
change:

```bash
openspec validate <name>
```

### Severity and uncertainty

When severity is unclear, downgrade (SUGGESTION > WARNING > CRITICAL). Reserve
CRITICAL for build failures, test failures, and security issues. Any CRITICAL or
IMPORTANT failure must be fixed — skipping the fix to accept everything is not
allowed.

## Step 1b / retry — verification failure (DECISION POINT)

If verification does not pass, pause and wait — via pi-ask-user — for the user to
decide: **fix** or **accept the deviation**. Do not automatically set
`verify_result: fail` and loop back to build without the user's choice. When the
user chooses fix, set `verify_result: fail` (the orchestrator routes back to
build).

**Retry limit:** after 3 consecutive failed verify cycles, on the 4th failure you
must not auto-continue fixing. Pause (pi-ask-user) with exactly two options:
"Accept all deviations and record" or "Continue fixing", for the user to decide.

## Step 3 — Finish the branch (DECISION POINT)

**Immediately execute:** Use `/skill:finishing-a-development-branch`. Skipping is
prohibited. Pause and wait — via pi-ask-user — for the user to choose the branch
handling method (merge locally / push and open PR / keep / discard). Do not
select based on recommendations, defaults, or current branch status. Only after
the user's choice and the operation completes may you record that the branch is
handled.

## Step 4 — Record evidence and advance

Write the verification report to
`docs/superpowers/reports/YYYY-MM-DD-<change-name>-verify.md`.

**Exit gate (self-check):** before advancing, confirm the report file exists and
the branch has been handled. If not, do not proceed.

When the change passes:

- Set `verify_result: pass` and `phase: archive` in `.sdd-state.yaml`.
- Mark the "Verify" todo `completed` and "Archive" `in-progress` via `manage_todo_list`.
- Dispatch to `/skill:sdd-archive`.

Note: passing verification does **not** mean auto-archiving. `sdd-archive` will
require an explicit final confirmation before it archives.
