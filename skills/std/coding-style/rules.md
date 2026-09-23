# Coding Style

An index of personal coding conventions. Read the reference file that matches what you're writing — don't work from this list alone.

## Always (every language)

- **Object keys and enum/union members must be English** — never CJK or other non-ASCII identifiers. This covers `z.enum([...])` members, `Record<>` keys, string-literal union types, and discriminant values; they're program identifiers and must read as code. User-facing *content* (display strings, prompt copy) may be in any language.

## When to read what

- **TypeScript (and the general conventions)** → [references/typescript.md](references/typescript.md)
  Type safety (no `any`/`as`/`!`/`@ts-ignore`), English-only identifiers, early return over nested conditionals, bind non-trivial iterables before looping, named exports over default exports, JSDoc comments, imports rule: same directory tree uses `./` and `../` (e.g. inside `src/modules/engine`), crossing project-level directories uses `@/` (e.g. `components/button` -> `lib/utils`), no namespace imports.
- **React** → [references/react.md](references/react.md)
  File/directory naming (kebab-case), named props interface, avoid `useEffect` (never mirror props into refs via an effect), early return in JSX, no direct browser globals, Tailwind: combine `className` with `cn()` only (no ternaries or template strings). React code is also TypeScript, so typescript.md applies on top.
