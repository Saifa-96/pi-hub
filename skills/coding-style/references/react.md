# React Conventions

React-specific details for the [coding-style](../SKILL.md) skill. The general principles (early return, named exports, avoiding side effects) live in the top-level skill; this file covers their React-specific shape plus React-only rules.

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

## Files & exports

- Complex modules split into a subfolder with individual component files; `index.ts` re-exports all.
- Named exports only, no default exports.
