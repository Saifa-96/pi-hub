# React Conventions

React-specific details for the [coding-style](../../rules.md) rules. React code is also TypeScript, so the general conventions (type safety, early return, named exports, avoiding side effects) in [typescript.md](../typescript.md) apply too; this file covers their React-specific shape plus React-only rules. React's deeper references: [composable-parts.md](composable-parts.md) (component families) and [../tailwind.md](../tailwind.md) (class composition, where `className` meets Tailwind).

## Props

- **Always declare props as a named interface, not an inline object literal.** Naming convention: `<ComponentName>Props`. Place the interface directly above the component. Inline literals are tolerated only when refactoring third-party generated code that we don't own.

```tsx
// avoid — inline literal, hard to reuse / extend / search for
function Chat({ characterId }: { characterId: string }) { ... }

// prefer — named interface immediately above the component
interface ChatProps {
  characterId: string;
}
export function Chat({ characterId }: ChatProps) { ... }
```

## Effects

- **Avoid `useEffect` unless there's no other way.** Effects can introduce unexpected behavior — re-runs, stale closures, ordering issues. Prefer event handlers or values derived during render. If you think an effect is the only option, say so explicitly and why.
- **Never write to a ref from inside a `useEffect` just to mirror a prop or value.** The "latest value" ref pattern — an effect whose only job is `someRef.current = someValue` — is banned. It tears the ref's value one render behind during the commit, and exists only to work around an effect that shouldn't be there. Assign the ref during render instead, or remove the indirection entirely.

```tsx
// avoid — effect that mirrors a prop into a ref
const onAudioLinkedRef = useRef(onAudioLinked);
useEffect(() => {
  onAudioLinkedRef.current = onAudioLinked;
}, [onAudioLinked]);

// prefer — assign during render; the ref is always current, no effect needed
const onAudioLinkedRef = useRef(onAudioLinked);
onAudioLinkedRef.current = onAudioLinked;

// better — if you only need the value at call time, capture it without a ref at all
// (close over the prop directly in the handler, or pass it in when you call)
```

If you reach for this pattern to satisfy a stale-closure problem (e.g. a queue pump or subscription created once needs the latest handler), the real fix is usually to assign the ref during render, or to recreate the subscription when the dependency changes — not an effect whose body is a single ref write.

## Conditional rendering

- **When a branch produces a wholly different top-level render, use an early `return`, not a ternary in JSX.** A component that shows an empty state, a skeleton, or an error surface *instead of* its main body should guard with `if (cond) return <Empty />;` before the main `return`. Reserve ternaries (and `&&`) for small inline pieces *within* a tree — a badge, a label, one conditional row — not for choosing between two full screens.

```tsx
// avoid — two full screens wrapped in a JSX ternary
return (
  <>
    {items.length === 0 ? (
      <CollectionEmpty ... />
    ) : (
      <MasterDetailGrid ... />
    )}
  </>
);

// prefer — early return for the distinct branch, main body stays flat
if (items.length === 0) {
  return <CollectionEmpty ... />;
}

return (
  <MasterDetailGrid ... />
);
```

## Browser globals

- **Do not use `window` (or `document`, `localStorage`, etc.) without explicit user approval.** Reach for framework hooks and React state instead. Ask before introducing direct browser-global access.

## Tailwind

Class composition and scale-vs-arbitrary-value rules live in [../tailwind.md](../tailwind.md) — `cn()` only (never ternaries or template strings in `className`), canonical scale utilities over exact-equivalent arbitrary values.

## Composable part APIs

Components that consumers must compose (libraries, editor shells, multi-part widgets) follow the Radix-style part model — parts + shared context, spread + ref on leaves, className merge, event chaining, `data-state`, controlled/uncontrolled, `asChild`/`Slot` delegation. That reference is separate and thorough: read [composable-parts.md](composable-parts.md) before building or reviewing such components.

## Files & directories

- Directory and file names use **kebab-case**.
- Component files use descriptive names (not `index.tsx`); `index.ts` is for re-exports only.
- Complex modules split into a subfolder with individual component files; `index.ts` re-exports all.
- Named exports only, no default exports.
