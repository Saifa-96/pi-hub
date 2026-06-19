---
name: coding-style
description: MANDATORY before writing or refactoring code in ANY language. Language-agnostic personal coding-style preferences — guard distinct branches with early returns instead of nested ternaries, bind non-trivial iterables to a named local before looping, prefer named exports over default exports, and avoid unnecessary side effects in favor of values derived during computation. Always read this skill before writing code — do not rely on memory. React-specific details live in references/react.md.
---

# Coding Style

Language-agnostic style preferences. Apply to every language; reach for the framework-specific notes only where they apply.

## Early return over nested conditionals

- **When a branch produces a wholly different result, use an early `return`, not a nested ternary.** A function/component that yields an empty state, a skeleton, an error surface, or any distinct path *instead of* its main body should guard with `if (cond) return ...;` before the main body.
- Reserve ternaries (and short-circuits like `&&`) for small inline pieces *within* a larger expression — a single value, a label, one conditional fragment — not for choosing between two full outputs.
- Rationale: early returns keep each branch at the top indentation level and scannable, avoid deeply nested conditionals whose arms are easy to confuse, and read as "handle the exceptional case, then get on with the main work."

## Bind non-trivial iterables before looping

- **Bind any non-trivial iterable to a named local before the loop, then iterate the name.** The loop header should read as a noun, not a computation.
- **Trivial** (may sit directly in the loop header) = a bare identifier (`xs`) or a property-access chain (`foo.bar.baz`).
- **Non-trivial** (bind first) = function/method calls (`.values()`, `getList()`), expressions with operators (`a ?? []`, `cond ? x : y`), spreads, array/object literals — anything that performs work or constructs a value.
- The name documents *what* is being iterated and keeps the header scannable; re-running the expression mid-debug, hovering for type info, or stepping in a debugger all become trivial. Applies to all loop forms.

```
// avoid — operator expression in the loop header
for (const tc of delta.tool_calls ?? []) { ... }
// prefer
const deltaToolCalls = delta.tool_calls ?? [];
for (const tc of deltaToolCalls) { ... }

// avoid — method call in the loop header
for (const tc of toolCallsByIndex.values()) { ... }
// prefer
const pendingToolCalls = toolCallsByIndex.values();
for (const tc of pendingToolCalls) { ... }
```

## Named exports over default exports

- **Prefer named exports; avoid default exports** in any module system that supports both. Named exports keep a symbol's name stable across its definition and every import site, so renames, searches, and refactors stay consistent. Default exports let each importer pick its own name, which fragments the codebase.

## Avoid unnecessary side effects

- **Prefer values derived during normal computation over side-effecting machinery.** Reactive effects, observers, lifecycle callbacks, and mutable shared state introduce re-runs, stale captures, and ordering hazards.
- Compute from inputs where you can, handle changes in the event/handler that caused them, and reach for an effect-style mechanism only when there is genuinely no other way — and say so explicitly when you do.

## Framework-specific details

- **React** (named props interface, avoid `useEffect`, browser globals) → [references/react.md](references/react.md)
