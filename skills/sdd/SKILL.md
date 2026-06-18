---
name: sdd
description: Spec-driven development orchestrator. Use when the user wants to build a feature or change through a structured spec-first workflow, or types /sdd. Detects the current phase and dispatches to the right sub-skill across five phases (open → design → build → verify → archive), combining OpenSpec for WHAT and Superpowers for HOW.
---

# SDD — Spec-Driven Development Orchestrator

This skill is the single entry point. It does not implement phases itself — it
**detects the current phase and dispatches** to the matching sub-skill.

**Core principle: deep design via brainstorming cannot be skipped. Every change
goes through the full open → design → build → verify → archive flow.**

OpenSpec owns WHAT (proposal, spec lifecycle, archive). Superpowers owns HOW
(brainstorming, planning, TDD, review, wrap-up). SDD chains them.

## Workspace conventions

SDD uses OpenSpec and Superpowers with their native, default locations in the
target project — artifacts belong to the project being built:

- OpenSpec root: `openspec/`
- Changes: `openspec/changes/<name>/`
- State file: `openspec/changes/<name>/.sdd-state.yaml`
- Design docs: `docs/superpowers/specs/`
- Plans: `docs/superpowers/plans/`
- Reports: `docs/superpowers/reports/`

The `openspec` binary is provided globally by pi-hub (it is on PATH via the shell
command prefix), so the target project does not need to install it.

## Step 0 — Output language

Use the language of the user request that triggered this workflow as the default
output language. When resuming an existing change with a dominant artifact
language, preserve that language unless the user explicitly asks to switch.

## Step 1 — Ensure OpenSpec is initialized

Check whether `openspec/` exists in the target project.

- If it does **not** exist: initialize it before anything else:
  ```bash
  openspec init . --tools none
  ```
  Use `--tools none` deliberately: SDD drives OpenSpec through the CLI directly
  (`openspec instructions`, `openspec new`, etc.), so it does not need OpenSpec's
  per-tool skill/command files.

  Then create the docs working directories:
  ```bash
  mkdir -p docs/superpowers/specs docs/superpowers/plans docs/superpowers/reports
  ```
- If it exists: continue.

If the `openspec` command is not found, stop and tell the user that pi-hub's
`openspec` binary is not on PATH — they should verify `PI_CODING_AGENT_DIR` is set
and `shellCommandPrefix` is active. Do not fall back to hand-writing artifacts.

## Step 2 — Discover active change

Run `openspec list --json` to list active changes.

| Active changes | Action |
|----------------|--------|
| 0 | Dispatch to `/skill:sdd-open` (create a new change) |
| exactly 1 | Ask the user (via pi-ask-user) whether to resume it or start a new one |
| multiple | Present the list (via pi-ask-user) and let the user choose which to work on |

When the user chooses "new change", you **must** dispatch to `/skill:sdd-open`.
Do not create the change directly — `sdd-open` does the dual init (OpenSpec
artifacts + `.sdd-state.yaml`), and skipping it leaves the state file missing so
later phase detection breaks.

## Step 3 — Read state and detect phase

For the active change, read `openspec/changes/<name>/.sdd-state.yaml`.
If it is missing or malformed, fall back to verifiable file state
(`openspec status`, presence of design doc / plan / report) and **correct the
state file before continuing** — verifiable file state is the source of truth.

Re-run this detection every time the skill starts, including after context
compaction. Do not trust conversation history for the current phase.

## Step 4 — Phase routing (first match wins)

1. `archived: true` → Workflow complete. Report and stop.
2. `verify_result: pass` and not archived → `/skill:sdd-archive`
3. `verify_result: fail` → Pause (pi-ask-user): ask the user to fix or accept
   the deviation. Only after the user chooses "fix", set `verify_result: pending`
   and dispatch to `/skill:sdd-build`.
4. `phase: verify` (or tasks.md fully checked) → `/skill:sdd-verify`
5. `phase: build` (or design doc exists but plan/execution incomplete) → `/skill:sdd-build`
6. `phase: design` (or change exists but no design doc) → `/skill:sdd-design`
7. `phase: open` (or active change exists but `.sdd-state.yaml` missing) → `/skill:sdd-open`
8. No active change → `/skill:sdd-open`

## Continuous execution

Starting from the detected phase, continue automatically through later phases.
**Auto-advancing only applies at transition points that have no user decision.**
At every user decision point below, you must pause and wait for the user's
explicit response via pi-ask-user. Never substitute recommendation rules,
defaults, or "the user would probably agree" for an actual user choice, and
never just print options as text and then keep going.

## Progress tracking (keep these in sync)

SDD progress lives in three places. Keep all three current as you work — they
drift apart otherwise, which is the most common failure:

1. **Pi todo widget** (`manage_todo_list` tool) — the live view the user sees.
   At the start of a `/sdd` run, write the five phases as todos:
   ```jsonc
   { "operation": "write", "todoList": [
     { "id": 1, "title": "Open: clarify + create change", "status": "..." },
     { "id": 2, "title": "Design: brainstorm", "status": "..." },
     { "id": 3, "title": "Build: plan + implement", "status": "..." },
     { "id": 4, "title": "Verify", "status": "..." },
     { "id": 5, "title": "Archive", "status": "..." }
   ]}
   ```
   Mark the current phase `in-progress` and completed phases `completed`. When
   entering the build phase, you may expand it into per-task todos (see sdd-build).
   If the `manage_todo_list` tool is unavailable, skip this silently.
2. **`tasks.md`** (OpenSpec) — check off each task as it is actually completed.
3. **`.sdd-state.yaml`** — the `phase` field, advanced by each sub-skill on exit.

## State file format (`.sdd-state.yaml`)

Six fields only:

```yaml
workflow: full            # always full in this version
phase: open               # open | design | build | verify | archive
design_doc: null          # path to design doc once written
plan: null                # path to plan once written
verify_result: null       # null | pending | pass | fail
archived: false           # true once archived
```

State transitions are performed by the sub-skills as they complete each phase.
