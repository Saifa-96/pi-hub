---
name: type-safety
description: MANDATORY before writing or editing typed code in ANY statically-typed language. Language-agnostic rule against type escape hatches — never use `any`, unchecked casts (`as`, `as unknown as`), or their equivalents that defeat the type checker, unless the user explicitly agrees. Always read this skill before writing typed code — do not rely on memory. TypeScript specifics live in references/typescript.md.
---

# Type Safety

Applies to every statically-typed language (TypeScript, Go, Rust, Kotlin, Swift, C#, Java, etc.).

## Core rule

- **Never reach for a type escape hatch that defeats the type checker** unless the user explicitly agrees. The whole point of a static type system is the guarantees it gives; opting out of them silently throws those guarantees away.
- This covers, by language:
  - **TypeScript** — `any`, `as`, `as unknown as`, non-null `!`, `@ts-ignore` / `@ts-expect-error`
  - **Go** — `interface{}` / `any` where a concrete type is known, unchecked type assertions `x.(T)`
  - **Rust** — `unsafe` to skip the borrow checker, `unwrap()`/`as` to paper over a mismatch
  - **C# / Java / Kotlin** — casting to `object`/`Object` or using raw/`dynamic` types to dodge a check
- When the real type is awkward, **model it properly** — narrow with runtime checks, use a discriminated union / sum type, introduce a generic, or validate at the boundary. Don't cast your way past it.
- If an escape hatch is genuinely unavoidable (a third-party type is wrong, a serialization boundary), **ask first** and explain why, then isolate it to the smallest possible scope with a comment saying why it's safe.

## Language-specific details

- **TypeScript** → [references/typescript.md](references/typescript.md)
