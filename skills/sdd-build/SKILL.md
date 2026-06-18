---
name: sdd-build
description: SDD phase 3 (build). Writes an implementation plan with Superpowers, then executes it in an isolated workspace with optional TDD. Invoked by the sdd orchestrator; do not call directly unless resuming the build phase.
---

# SDD Phase 3 — Build (Superpowers owner)

Plan and implement the change. This is the longest phase.

## Step 0 — Entry check

Read `openspec/changes/<name>/.sdd-state.yaml`. Confirm `phase: build`
and that `design_doc` points to an existing file. Read the design doc and the
OpenSpec artifacts as context.

## Step 1 — Write the plan

**Immediately execute:** Use `/skill:writing-plans`. Skipping this step is
prohibited. If the skill is unavailable, stop and tell the user to install or
enable Superpowers skills; do not substitute with normal conversation.

Before writing the plan, record the base ref for later change-size accounting:

```bash
git rev-parse HEAD
```

Write the plan to `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`. The plan header
must include:

```yaml
---
change: <change-name>
design-doc: <path to design doc>
base-ref: <git sha from above>
---
```

## Step 2 — Plan ready (DECISION POINT)

After the plan exists, pause and wait — via pi-ask-user — for the user to choose:

- **Continue** — proceed to Step 3.
- **Pause here** — stop so the user can review or switch models. Save state and
  exit cleanly; the orchestrator will resume at build.

Must not auto-continue past this point.

## Step 3 — Choose isolation, execution, and TDD (DECISION POINT)

Pause and wait — via pi-ask-user — for the user to explicitly choose all three:

1. **Isolation**: `branch` or `worktree`
2. **Execution**: `executing-plans` (main session executes) or
   `subagent-driven-development` (dispatch to subagents)
3. **TDD mode**: `tdd` or `direct`

Recommendations may explain tradeoffs, but are suggestions only — not a
substitute for the user's choice. Do not pick any of the three based on
recommendation rules or defaults.

### Apply isolation

- **branch**: confirm or let the user override the branch name (pi-ask-user),
  using the convention `feature/YYYYMMDD/<change-name>`, then
  `git checkout -b <name>`. Do not create the branch without confirming the name.
- **worktree**: Use `/skill:using-git-worktrees` to create the isolated
  workspace. Do not bypass it with raw shell commands.

### Apply execution mode

- **executing-plans**: **Immediately execute:** Use `/skill:executing-plans`.
  Skipping is prohibited.
- **subagent-driven-development**: dispatch implementation to subagents. The main
  session only coordinates and must not write implementation code directly.

### Apply TDD mode

- **tdd**: before the first task, **Immediately execute:** Use
  `/skill:test-driven-development` once. Follow RED → GREEN → REFACTOR; must not
  skip the failing-test verification phase.
- **direct**: implement directly.

### Track per-task progress (keep both in sync)

When you start executing, mirror the plan's tasks into the Pi todo widget so the
user sees live progress, and check off `tasks.md` as you go:

1. Write the plan/tasks.md items into `manage_todo_list` (one todo per task). If
   the tool is unavailable, skip silently.
2. **As each task is completed**: mark its todo `completed` AND check off the
   corresponding line in `openspec/changes/<name>/tasks.md`. Do both every time —
   do not batch them to the end. This is the step most often skipped.
3. Mark the next task `in-progress` before starting it.

## Step 3b — Debug gate

If a crash or test failure occurs during execution, **immediately** use
`/skill:systematic-debugging`. Do **not** propose or implement source-code fixes
before the root-cause investigation is complete. After the fix, run the failing
test, related tests, and the project's build/verify commands until all pass. Keep
the test, fix, and tasks.md checkoff inside the current change — do not spin off a
separate "write tests" change.

## Step 4 — Spec increment updates

As implementation reveals needed spec changes, update the OpenSpec delta spec by
size:

- **Small** (clarification, single scenario): edit directly.
- **Medium**: pause, return to `/skill:brainstorming` to update, then continue.
- **Large** (new tasks exceed ~50% of the original tasks.md count): this is
  outside the original scope — pause (pi-ask-user) and let the user decide
  whether to split into a new change via `/skill:sdd-open`.

## Step 5 — Code review before exit

In `executing-plans` mode, before leaving build, use
`/skill:requesting-code-review` at least once. CRITICAL findings (security, data
loss, build/test failures) must be fixed and must not be carried into verify. If
the review skill is unavailable, note `<!-- review skipped: skill unavailable -->`
in tasks.md.

## Step 6 — Exit gate and advance

Before leaving build, confirm (self-check, no script needed):

- tasks.md is fully checked off and the plan's tasks are complete.
- The project's build and tests explicitly run and pass. Do not rely on
  assumption — actually run the project's build/test command.

If either is not satisfied, do not proceed. Once satisfied:

- Set `phase: verify` and `verify_result: pending` in `.sdd-state.yaml`.
- Set `plan:` to the plan path.
- Dispatch to `/skill:sdd-verify`.
