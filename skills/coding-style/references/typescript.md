# TypeScript

TypeScript and general coding conventions for the [coding-style](../SKILL.md) skill. These apply to all TypeScript code; React adds more on top in [react.md](react.md).

## Type safety

- **Never reach for a type escape hatch that defeats the type checker** unless the user explicitly agrees. The point of the type system is the guarantees it gives; opting out silently throws them away.
- No implicit `any`, `unknown` used as a dumping ground, `as unknown as`, or `as` casts.
- Avoid non-null assertions (`!`) and `@ts-ignore` / `@ts-expect-error` to silence the checker.
- When the real type is awkward, **model it properly** — narrow with type guards / `in` checks, use a discriminated union, introduce a generic, or validate at the boundary with a schema. Don't cast your way past it.
- If an escape hatch is genuinely unavoidable (a third-party type is wrong, a serialization boundary), **ask first**, explain why, and isolate it to the smallest possible scope with a comment saying why it's safe.

## Named types over inline object literals

- **Declare a parameter's object shape as a named `interface` or `type`, not an inline object-type literal.** Inline literals on a function signature are hard to reuse, extend, search for, and read. Name the shape and reference it.
- Naming convention: `<FunctionName>Deps` / `<FunctionName>Options` / `<ThingName>Props` — whatever reads as the shape's role.
- Inline literals are tolerated only when refactoring third-party generated code we don't own.

```ts
// avoid — inline object-type literal on the signature
export function createDeepSeekLlmAdapter(deps: {
  storage: StorageAdapter;
}) { ... }

// prefer — named type, referenced from the signature
interface DeepSeekLlmAdapterDeps {
  storage: StorageAdapter;
}
export function createDeepSeekLlmAdapter(deps: DeepSeekLlmAdapterDeps) { ... }
```

## Identifiers must be English

- **Object keys and enum/union members must be English — never CJK (Chinese/Japanese/Korean) or other non-ASCII identifiers.** This covers `z.enum([...])` members, `Record<>` keys, string-literal union types, and discriminant values. They're program identifiers, compared and indexed against in code, so they must read as code.
- User-facing *content* — display strings, prompt copy, labels rendered to the screen — may be in any language. The rule is about keys and enum values, not text.

```ts
// avoid — enum members and record keys in Chinese
const SIGNAL_LEVELS = ["高", "中", "低"] as const;
const WEIGHT: Record<SignalLevel, number> = { 高: 0.4, 中: 0.2, 低: 0.0 };
if (signal.topicRelevance === "低") return 0;

// prefer — English identifiers; map to localized text only at the display edge
const SIGNAL_LEVELS = ["high", "medium", "low"] as const;
const WEIGHT: Record<SignalLevel, number> = { high: 0.4, medium: 0.2, low: 0.0 };
if (signal.topicRelevance === "low") return 0;
```

If an LLM prompt instructs the model to emit one of these values, the prompt must list the **English** values too, so the model's output matches the schema. Localized wording belongs in the prose around the value, not in the value itself.

## Early return over nested conditionals

- **When a branch produces a wholly different result, use an early `return`, not a nested ternary.** A function that yields an empty state, an error path, or any distinct result *instead of* its main body should guard with `if (cond) return ...;` before the main body.
- Reserve ternaries (and short-circuits like `&&`) for small inline pieces *within* a larger expression — a single value, a label, one conditional fragment — not for choosing between two full outputs.
- Rationale: early returns keep each branch at the top indentation level and scannable, avoid deeply nested conditionals whose arms are easy to confuse, and read as "handle the exceptional case, then get on with the main work."

## Bind non-trivial iterables before looping

- **Bind any non-trivial iterable to a named local before the loop, then iterate the name.** The loop header should read as a noun, not a computation.
- **Trivial** (may sit directly in the loop header) = a bare identifier (`xs`) or a property-access chain (`foo.bar.baz`).
- **Non-trivial** (bind first) = function/method calls (`.values()`, `getList()`), expressions with operators (`a ?? []`, `cond ? x : y`), spreads, array/object literals — anything that performs work or constructs a value.
- The name documents *what* is being iterated and keeps the header scannable; re-running the expression mid-debug, hovering for type info, or stepping in a debugger all become trivial. Applies to all loop forms.

```ts
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

- **Prefer named exports; avoid default exports.** Named exports keep a symbol's name stable across its definition and every import site, so renames, searches, and refactors stay consistent. Default exports let each importer pick its own name, which fragments the codebase.

## Comments

- **Document a function or variable with a JSDoc block (`/** … */`), never a `//` line comment.** A `//` comment is reserved for explaining a single line of code inline, where a sentence of "why" helps the reader.
- **Keep JSDoc simple — describe only what the thing does.** No process/planning metadata ("P2 core", "decision 11", "step 3 of the pipeline"), no history, no rationale essays. One or two plain sentences on the purpose.
- **JSDoc says *what*, not *how*.** Don't describe internal mechanics — what order things are pushed, which branch is taken, why a value lands where it does. That belongs as a `//` comment on the specific line that does it, where it stays true as the code moves. The JSDoc is the contract a caller reads without opening the body.
- **Always write JSDoc as a multi-line block, never as a single line.** Even a one-sentence comment uses the three-line form: `/**` on its own line, the text on a ` * ` line, and `*/` on its own line. Don't collapse it to `/** text */`.

```ts
// avoid — single-line JSDoc
/** Fetch a character's top-K relevant private memories for a query. */

// prefer — multi-line block, even for one sentence
/**
 * Fetch a character's top-K relevant private memories for a query.
 */
```

- If a "why" genuinely needs recording (a non-obvious constraint, a workaround), attach it as a `//` comment on the specific line it explains, not inside the JSDoc.

```ts
// avoid — // block describing a function, with process noise
// P2 core: build recall for a character before they speak.
// See decision 11. Returns [] for blank query.
export function buildRecall(...) { ... }

// prefer — JSDoc says what it does, plainly
/**
 * Fetch a character's top-K relevant private memories for a query.
 */
export function buildRecall(...) {
  // blank query → skip the embedding call entirely
  if (!query.trim()) return [];
  ...
}
```

```ts
// avoid — JSDoc explains internal mechanics (where the recall block lands and why)
/**
 * Assemble one character's LLM context. The recall block is appended as the
 * final message rather than folded into `system`, which keeps the persona
 * prefix stable across turns and so cacheable.
 */
export function assembleCharacterContext(parts) {
  ...
  messages.push({ role: "user", content: recallBlock });
}

// prefer — JSDoc states the purpose; the "how/why" sits on the line it explains
/**
 * Assemble one character's LLM context (system prompt + message stream) from
 * the parts the caller fetches.
 */
export function assembleCharacterContext(parts) {
  ...
  // Appended as the final message rather than folded into `system`, so the
  // persona prefix stays stable across turns and therefore cacheable.
  messages.push({ role: "user", content: recallBlock });
}
```

## Imports

- Always use `@/` absolute paths, never relative paths.
- Don't use `import * as Ns from "..."` — name the symbols you actually need so reviewers can see the surface a file consumes. **Ask the user before introducing a namespace import**, even when the package's own typings push you toward one.
