---
name: sdd-archive
description: SDD phase 5 (archive). Merges the change's delta spec into the main specs and archives it via OpenSpec, after explicit user confirmation. Invoked by the sdd orchestrator; do not call directly unless resuming the archive phase.
---

# SDD Phase 5 — Archive (OpenSpec owner)

Merge the completed change into the main specs and archive it.

## Step 0 — Entry check

Read `openspec/changes/<name>/.sdd-state.yaml`. Confirm
`verify_result: pass`, `phase: archive`, and `archived: false`.

## Step 1 — Final archive confirmation (DECISION POINT)

Passing verification does **not** mean auto-archiving. Pause and wait — via
pi-ask-user — for the user to confirm. Before asking, present the irreversible
actions this archive will perform:

- Merge the main specs with the OpenSpec delta semantics
- Annotate the design doc and plan as archived
- Move the change to the archive directory

Options:

- **Confirm archive** — proceed to Step 2.
- **Needs adjustment / re-verification** — do not archive; set `phase: verify`
  and `verify_result: pending` in the state file, then dispatch to
  `/skill:sdd-verify`.
- **Not yet** — do not archive; keep `phase: archive` and stop. The user can
  re-invoke `/skill:sdd` later.

Must not run the archive command before the user selects "Confirm archive".

## Step 2 — Archive

```bash
openspec archive <name> --yes
```

This merges the delta spec into the main specs and moves the change to
`openspec/changes/archive/`.

If the change is infrastructure/tooling/docs-only with no spec delta, use
`--skip-specs`.

## Step 3 — Close the loop

- Set `archived: true` in the state file (note: the change directory has moved to
  the archive path, so update the state file at its new location, or simply
  report completion since the active change no longer exists).
- Mark the "Archive" todo `completed` via `manage_todo_list` (all five phases now
  complete; the widget auto-clears shortly after).
- Report what was archived and where.

> **Note:** after a successful archive, the active change directory no longer
> exists. Do not run further OpenSpec commands against the old active change name.
