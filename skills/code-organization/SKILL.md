---
name: code-organization
description: MANDATORY before writing or editing code in ANY language. Language-agnostic rules for how big a source file should get and how to order its contents top-down. Always read this skill before creating a source file or adding to an existing one — do not rely on memory.
---

# Code Organization

Language- and stack-agnostic rules for file size and internal layout. Apply to every source file regardless of language.

## File Size

- Keep files under 400 lines. When a file approaches that, split it — extract whatever fits the file's nature (helpers, sub-components, related logic) into sibling files.
- If a file genuinely belongs together and can't be split without hurting clarity (e.g. a complex state machine, a tightly coupled algorithm), **ask before exceeding 400 lines** and explain why splitting would make the code worse. Don't silently let files grow past the limit.

## File Layout (top-down reading order)

Order a file so a reader meets the most important facts first and drills into implementation only if needed:

1. **Module-level constants** — at the very top, above everything else. Constants set the "ground truth" of the file; readers should see them before any usage.
2. **Top-level / exported definition** — the public entry point of the file (the main component, class, or function).
3. **Internal definitions** — in the order they are composed, parents before children.
4. **Helper functions, pure utilities, and schemas** — at the bottom. Schemas (e.g. validators) are implementation detail on par with helpers unless shared widely, in which case hoist them up with the constants.
5. **Type/props declarations** — place each definition's type or signature declaration *directly above the thing it describes*, not batched at the top or bottom of the file.

Rationale: someone opening the file should see the public contract within the first screen — constants that govern the file, then the exported definition. Helpers and schemas are implementation detail and belong at the end. Type declarations stay next to what they describe so you never have to scroll to learn the contract.
