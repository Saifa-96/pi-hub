# Coding Style

An index of personal coding conventions. Read the reference file that matches what you're writing — don't work from this list alone.

## Always (every language)

- **Object keys and enum/union members must be English** — never CJK or other non-ASCII identifiers. This covers `z.enum([...])` members, `Record<>` keys, string-literal union types, and discriminant values; they're program identifiers and must read as code. User-facing *content* (display strings, prompt copy) may be in any language.

## When to read what

- **TypeScript (and the general conventions)** → [references/typescript.md](references/typescript.md)
  Type safety (no `any`/`as`/`!`/`@ts-ignore`), English-only identifiers, early return over nested conditionals, bind non-trivial iterables before looping, named exports over default exports, JSDoc comments, imports rule: same directory tree uses `./` and `../` (e.g. inside `src/modules/engine`), crossing project-level directories uses `@/` (e.g. `components/button` -> `lib/utils`), no namespace imports.
- **React** → [references/react/index.md](references/react/index.md)
  File/directory naming (kebab-case), named props interface, avoid `useEffect` (never mirror props into refs via an effect), early return in JSX, no direct browser globals. The react/ folder also holds the composable-parts reference below.
- **Tailwind** → [references/tailwind.md](references/tailwind.md)
  `cn()` only for class composition (never ternaries/template strings — tailwind-merge must resolve conflicts), canonical scale utilities over exact-equivalent arbitrary values (`max-w-[220px]` → `max-w-55`, but `w-[3px]` stays — readability wins), no `suggestCanonicalClasses` hints left on touched lines.
- **Composable part APIs (component families, Radix-style)** → [references/react/composable-parts.md](references/react/composable-parts.md)
  Read before building/reviewing components consumers compose (libraries, editor shells, multi-part widgets): parts + shared context, spread + ref on leaf parts, className merge, event chaining, `data-state`, controlled/uncontrolled, `asChild`/`Slot` semantics, review checklist. React code is also TypeScript, so typescript.md applies on top.
