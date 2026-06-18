---
name: sdd-design
description: SDD phase 2 (design). Runs Superpowers brainstorming on top of the OpenSpec proposal to produce a technical design document. Invoked by the sdd orchestrator; do not call directly unless resuming the design phase.
---

# SDD Phase 2 — Design (Superpowers owner)

Turn the clarified OpenSpec proposal into a technical design through deep
brainstorming. Superpowers owns HOW.

## Step 0 — Entry check

Read `openspec/changes/<name>/.sdd-state.yaml`. Confirm `phase: design`.
Read the open-phase artifacts (proposal.md, design.md, tasks.md, and any
`specs/*/spec.md`) as context.

## Step 1 — Brainstorm the design

**Immediately execute:** Use `/skill:brainstorming`. Skipping this step is
prohibited. When loading, include ARGUMENTS:
`Language: Use the language of the user request that triggered this workflow`.

If the `brainstorming` skill is unavailable, stop and tell the user to install or
enable Superpowers skills. Do not substitute this step with normal conversation.

Guidance while brainstorming:

- The OpenSpec artifacts are the upstream source of truth, but do **not** weaken
  the brainstorming clarification flow by "skipping redundant exploration." If
  goals, scope, non-goals, acceptance scenarios, or key constraints remain
  unclear, keep asking and form the design proposal first. Do not produce a
  design after only one Q&A turn.
- The brainstorming phase does **not** write the design doc file. It only
  produces a design proposal for user confirmation.
- Work through 2–3 approaches and step-by-step design confirmation per the
  brainstorming skill's own flow.

## Step 2 — Confirm the design (DECISION POINT)

After brainstorming produces a design proposal, pause and wait — via
pi-ask-user — for the user to explicitly confirm it. Must not create the final
design doc, write `design_doc`, advance the phase, or dispatch to build before
confirmation. If the user requests changes, keep iterating until they confirm.

## Step 3 — Write the design doc

Write the design doc to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` with
minimal frontmatter:

```yaml
---
change: <change-name>
role: technical-design
canonical_spec: openspec
---
```

### Spec patch boundary

If brainstorming surfaced gaps in the OpenSpec delta spec, you may only propose
**spec patches** — limited to supplementing acceptance scenarios, correcting
ambiguous descriptions, or adding boundary conditions — and write them back to
`openspec/changes/<name>/specs/*/spec.md`. Do **not** substantially
rewrite the delta spec's structure or scope, and do **not** create a second
requirements spec inside the design doc. If major changes are needed, flag them
as design findings and return to brainstorming for confirmation.

## Step 4 — Update state and advance

- Set `design_doc:` to the design doc path in `.sdd-state.yaml`.
- Set `phase: build`.
- Mark the "Design" todo `completed` and "Build" `in-progress` via `manage_todo_list`.
- Dispatch to `/skill:sdd-build`.
