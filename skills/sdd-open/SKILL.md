---
name: sdd-open
description: SDD phase 1 (open). Creates an OpenSpec change with proposal, design, and tasks artifacts after clarifying requirements with the user. Invoked by the sdd orchestrator; do not call directly unless resuming the open phase.
---

# SDD Phase 1 — Open (OpenSpec owner)

Create a well-clarified OpenSpec change. OpenSpec is the upstream source of truth
for WHAT is being built.

OpenSpec uses its native `openspec/` directory in the project root.

## Step 0 — Output language

Use the language of the triggering user request.

## Step 1 — Explore and clarify

Explore the problem space. **Do not treat one Q&A turn as sufficient
clarification.** Continue asking until you and the user align on a clarification
summary covering: goals, non-goals, scope, open questions, and draft acceptance
scenarios.

Read the existing project context (files, docs, recent commits) before asking,
so questions are informed.

## Step 2 — Clarification complete (DECISION POINT)

Before creating any OpenSpec artifact, pause and wait — via pi-ask-user — for the
user to confirm that requirements clarification is complete. Must not create
`proposal.md`, `design.md`, or `tasks.md` before the user confirms.

## Step 3 — Naming and scope guard

The change name must be supplied or confirmed by the user via pi-ask-user — do
not auto-generate or infer it. The change scope must match the user's
description — do not expand or narrow it on your own.

## Step 4 — Create the change

Create the change skeleton:

```bash
openspec new change <name>
```

Then create each artifact in order, using OpenSpec's enriched instructions:

```bash
openspec instructions proposal --change <name> --json
openspec instructions design --change <name> --json
openspec instructions tasks --change <name> --json
```

For each artifact, read the returned `instruction`, follow the `template`
structure, and write the file to its `resolvedOutputPath` under
`openspec/changes/<name>/`.

- `proposal.md` — Why + What
- `design.md` — high-level architecture decisions (kept lightweight; deep design
  happens in phase 2)
- `tasks.md` — checklist with at least one task

**Failure handling:** if any OpenSpec command errors, stop and report the error.
Do not fall back to hand-writing artifact prose — that silently bypasses project
rules and schema.

## Step 5 — Validate and verify files

```bash
openspec validate <name>
```

Confirm all three files exist and are non-empty. If any is missing or empty,
return to Step 4 to fill the gap before proceeding.

## Step 6 — Initialize state

Create `openspec/changes/<name>/.sdd-state.yaml`:

```yaml
workflow: full
phase: open
design_doc: null
plan: null
verify_result: null
archived: false
```

## Step 7 — Proposal review (DECISION POINT)

After the three documents pass the completeness check, pause and wait — via
pi-ask-user — for user confirmation. Options:

- **Confirm, proceed to next phase** — set `phase: design` in the state file,
  mark the "Open" todo `completed` and "Design" `in-progress` via
  `manage_todo_list`, then dispatch to `/skill:sdd-design`.
- **Needs adjustment** — collect adjustment notes, revise, and re-request
  confirmation.

Must not advance the phase or dispatch before the user confirms.
