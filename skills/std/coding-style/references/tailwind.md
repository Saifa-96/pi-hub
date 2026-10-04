# Tailwind Conventions

Styling reference for [coding-style](../rules.md); React code meets it at `className` (see [react/index.md](react/index.md)), but it applies anywhere Tailwind classes are composed. Tailwind-related lint/format decisions may also involve the repo's Tailwind config — check `components.json` / `globals.css` for the design-token scale before inventing values.

## Combine classes with `cn()` only — never ternaries, template strings, or `+` concatenation

Conditional or computed classes go through `cn(...)` (clsx + tailwind-merge). The tailwind-merge half is the point: it **resolves conflicting utilities by last-wins**, so consumer variants correctly override part defaults. Ternaries and template strings bypass that resolution and produce dead or doubled classes.

```tsx
// avoid — ternary in className
<button className={active ? "bg-blue-500 text-white" : "bg-gray-200"} />

// avoid — template string in className (and it drops the cn() merge point)
<div className={`${base} ${active ? "font-bold" : ""} p-2`} />

// prefer — cn(): conditionals in, conflicts resolved, consumer class last
<button className={cn("rounded px-3 py-1.5", active && "bg-blue-500 text-white", !active && "bg-gray-200")} />
```

This rule is what makes the part-API className contract work (`cn(base, className)` with the consumer's class last — see [react/composable-parts.md](react/composable-parts.md)): a raw template string would let the base class and the consumer's override fight instead of merge.

## Prefer canonical scale utilities over arbitrary values — when readability survives

If an arbitrary value is *exactly* expressible as a scale utility, use the scale form (assumes Tailwind v4's dynamic spacing scale, where any `N` resolves to `N` × 0.25rem). The Tailwind VS Code extension flags every violation as a `suggestCanonicalClasses` hint (hint-severity diagnostic, visible as inline gray text in the editor) — zero hints is the target state.

```tsx
// arbitrary value == exact scale multiple → canonical
"max-w-[220px]"  → "max-w-55"        // v4 spacing: N × 0.25rem (55 × 4 = 220)
"rounded-[50%]"  → "rounded-full"
"w-[64px]"       → "w-16"

// keep the arbitrary value when the canonical form is harder to read
"w-[3px]"        ≠ "w-0.75"          // fractional scale steps nobody recognizes
"h-[650px]"      ≠ "h-162.5"         // same — readability wins
```

Rule of thumb: convert when the canonical form is a familiar scale step (`rounded-full`, `size-*`, `p-14`); keep `[…]` when the equivalent requires unfamiliar fractional utilities. Scales are repo-tailwind-config facts (spacing 4px/N; `rounded-sm|md|lg` = 4|6|8px) — verify against the configured theme, not memory.

## One runnable check

When touching `className`s, run the repo's lint/typecheck after; canonical-class hints don't reach the terminal (hint severity ≠ Problems panel), so the editor hint is the only automated signal — treat "no inline gray suggestions on lines I touched" as part of done.
