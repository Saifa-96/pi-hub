# TypeScript Type Safety

TypeScript-specific rules for the [type-safety](../SKILL.md) skill.

## No escape hatches

- No implicit `any`, `unknown` used as a dumping ground, `as unknown as`, or `as` casts — unless the user explicitly agrees.
- Also avoid non-null assertions (`!`) and `@ts-ignore` / `@ts-expect-error` to silence the checker. Narrow the type instead (type guards, `in` checks, discriminated unions), or validate at the boundary with a schema.

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
