# Composable Part APIs (Radix-style)

React-specific reference for [coding-style](../../rules.md); applies on top of [index.md](index.md) and [typescript.md](../typescript.md). Read it before building or reviewing components that consumers must compose: component libraries, editor shells, dialogs, toolbars, any multi-region widget.

Primary sources, in reading order — consult them when this file is not enough:

1. Radix Primitives philosophy (the why) — https://github.com/radix-ui/primitives/blob/main/philosophy.md
2. Radix Composition guide (`asChild` mechanics + gotchas) — https://www.radix-ui.com/primitives/docs/guides/composition
3. Radix Slot utility docs — https://www.radix-ui.com/primitives/docs/utilities/slot
4. Building Composable React Components (derivation from `as` to `asChild`) — https://schof.co/building-composable-react-components/
5. Unpacking the Slot Component (source-level merge semantics) — https://www.yisukim.com/en/posts/unpacking-the-slot-component
6. The Hidden Docs of Radix UI (DismissableLayer / FocusScope internals) — https://wzhu.dev/posts/hidden-docs-of-radix

## When to apply

This reference is for **complex, multi-region, state-sharing components** — a toolbar with clusters, an editor with panels, a dialog family. It is NOT for simple visual leaves (`Badge`, `Chip`, `Box`, `Kbd`): a single element with presentational props needs no parts machinery. Radix explicitly excludes such components from this model. Simple leaves still follow the part API discipline below (spread + ref + className merge) — they just don't become families.

Litmus test: does the component have ≥2 regions that share state (list + detail, trigger + content), or do consumers plausibly need to drop/reorder/customize its regions? If no to both, write one component and stop.

## Architecture: parts + shared context

A family is a root plus sub-parts attached with `Object.assign`; each part maps 1-to-1 onto **one** DOM element (renders exactly one element, or none). Parts are addressed as `Family.Part`:

```tsx
export const EditorToolbar = Object.assign(EditorToolbarRoot, {
  Title: EditorToolbarTitle,
  Insert: EditorToolbarInsert,
  Export: EditorToolbarExport,
});

// default assembly: omit children
<EditorToolbar />

// custom assembly: children replaces the default wholesale
<EditorToolbar>
  <EditorToolbar.Title />
  <EditorToolbar.Export onExported={save} />
  <MyOwnNode />
</EditorToolbar>
```

**Parts share state through one context owned by the root — never through props threaded via the consumer.** This is the defining property of the pattern: `<Tabs.Trigger>` knows the active tab because the root provides it, not because the consumer wires callbacks part-to-part.

```tsx
interface TabsCtx { value: string; setValue: (v: string) => void; }
const Ctx = createContext<TabsCtx | null>(null);

function TabsRoot({ children }: TabsProps) {
  const [value, setValue] = useState<string>();
  return <Ctx.Provider value={{ value, setValue }}>{children}</Ctx.Provider>;
}
// Trigger/Panel read Ctx (and re-render through it) — zero wiring at the call site
```

Consequences:

- **Each part is standalone-usable.** If a part needs a provider (tooltip portal, theme), it carries its own — don't require the consumer to wrap the family in helper components.
- **Context accessors throw with a named, actionable error** when used outside the family (`"Tabs.Trigger must be used inside <Tabs>"`), not a silent `undefined` crash.
- Deviating from 1-to-1 (a part rendering two elements) must be justified in the part's JSDoc.

## Part API discipline

Applies to every leaf part of the family (and to simple standalone components).

### Open props surface: spread + ref

Type the props as an extension of the intrinsic element and forward everything you don't own:

```tsx
type ZoomProps = ComponentProps<"div">;

export function Zoom({ className, style, ref, ...rest }: ZoomProps) {
  return (
    <div
      ref={ref}
      {...rest}
      className={cn("flex items-center", className)}
      style={{ ...style, touchAction: "none" }} // structural key, after the spread
    />
  );
}
```

React 19: `ref` is a regular prop — destructure it and put it on the root element like any other. This is what lets consumers attach event handlers, `aria-*`, `data-testid`, and refs; without it the part is a closed box.

**JSX placement convention** (so ten agents produce one conflict semantics):

1. Destructure every prop the part itself uses or sets: `className`, `style`, specific handlers, `ref`, `children` if owned.
2. Merge the destructured ones explicitly — `cn(base, className)`, `callAll(consumerHandler, internalHandler)`, `{ ...consumerStyle, structuralKeys }`.
3. Spread `{...rest}` on the root element **first**; everything the part composes — merged props from step 2 and part-owned structural attributes (`style` with internal sizes, `role`, `data-*`) — comes **after** the spread so structural layout wins. Because step 1 removed every conflicting key, the spread cannot clobber a merge.

If the part holds an internal root ref, compose it with the consumer's — never drop either:

```tsx
function composeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const r of refs) {
      if (typeof r === "function") r(node);
      else if (r) r.current = node;
    }
  };
}

<div ref={composeRefs(ref, internalRootRef)} …>
```

Caveat: `ComponentProps<"div">` includes `children` — spreading `rest` lets consumers inject children into the root. That is extra composition surface; if the part's children are fully self-managed and injection would break it, declare `children?: never` (or `Omit`) and say why in the interface doc.

### className merges, never overrides

Always `cn(base, className)` with the consumer's class last. Never a ternary or template string (see the `cn()`-only rule in [../tailwind.md](../tailwind.md)).

### Event handlers chain — never swallow

If the part has an internal `onClick`/`onKeyDown`/…, the consumer's handler runs **first**, the internal one second, both execute. Consumer-first is what lets the consumer `preventDefault()`/`stopPropagation()` to opt out of the internal behavior. The handler must be destructured out of `rest`, or the spread will clobber the chain:

```tsx
function Trigger({ active, className, onClick, ref, ...rest }: TriggerProps) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cn("trigger", active && "trigger--on", className)}
      onClick={callAll(onClick, handleInternal)} // consumer first
    />
  );
}

const callAll =
  (...fns: Array<((...args: never[]) => void) | undefined>) =>
  (...args: never[]) => {
    for (const fn of fns) fn?.(...args);
  };
```

A prop that *replaces* the internal handler (or an internal handler that fires while the consumer's is ignored) is a bug magnet.

### UI state: `data-state` with enumerated strings

Expose state on the part's root element as `data-state="open" | "closed"`, `data-state="readonly"`, … — enumerated strings, not booleans, not class toggles. Consumers style (`[data-state=open] { … }`) and test against it without knowing internals. Same for other stable facts: `data-disabled`, `data-orientation`.

### Stateful parts: controlled AND uncontrolled

Any part with internal state supports both, like native form elements: `value` + `onValueChange` for control, `defaultValue` for uncontrolled. Controlled means render exactly what was passed (no internal echo); uncontrolled means internal state seeded once.

```tsx
interface AccordionProps {
  value?: string;                    // controlled
  defaultValue?: string;             // uncontrolled seed
  onValueChange?: (v: string) => void; // notification, both modes
}
```

## Providers render nothing

A context provider returns `children` inside `.Provider` — no wrapper `div` for CSS hooks, positioning, or state classes. The wrapper is invisible API surface that interferes with consumer layout (flex/grid children). If DOM is genuinely needed (a CSS scope, a positioned container), ship it as a **named part** (`<XEditor.Chrome>`) with its own file and docs — the provider still renders nothing.

## Render delegation: `asChild` + Slot

When a wrapper element would break the DOM — a library trigger around the app's `<Link>`, two wrappers around one button — support `asChild` instead of wrapping, via Radix's Slot (`@radix-ui/react-slot`):

```tsx
import { Slot } from "@radix-ui/react-slot";

function Button({ asChild, className, ...rest }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonStyles, className)} {...rest} />;
}
```

`Slot.Root` is the current (`@radix-ui/react-slot` ≥ 1.2) shape; older versions exported the component itself (`asChild ? Slot : "button"`).


`asChild` means: render **no** element of your own; clone the child and merge your behavior (handlers, aria, ref) into it. Merge semantics when slot and child conflict — child always wins, except events and refs where both participate:

| conflict    | result                                              |
| ----------- | --------------------------------------------------- |
| plain props | child's value                                       |
| `onXxx`     | child's runs first, then slot's (both execute)      |
| `style`     | per-key merge, child wins per key                   |
| `className` | concatenated                                         |
| `ref`       | composed — both refs point at the same node         |

Gotchas:

- **Multi-child part:** the child that receives the merge must be marked with `<Slottable>` (same package), or Slot throws on the extra siblings.
- **The slotted child must spread props and accept refs** (the part API discipline above) — otherwise delegation silently drops keyboard/a11y props.
- **Changing the element type shifts a11y responsibility to the consumer:** an `asChild` `Trigger` over a `div` is no longer focusable. Document it; don't fight it.

## Review checklist

Audit an existing family against this list:

- [ ] Complex enough to be a family? Simple leaves stayed single components?
- [ ] Parts share state via the root's context (no consumer-threaded wiring)?
- [ ] Every leaf part: `extends ComponentProps<"…">`, spreads `rest`, accepts `ref`?
- [ ] `className` merged via `cn(base, className)`, consumer last?
- [ ] Internal handlers chained after the consumer's (`callAll(consumer, internal)`)?
- [ ] Internal root refs composed (`composeRefs`), not dropped?
- [ ] UI state on the DOM as enumerated `data-state` (not booleans/classes)?
- [ ] Stateful parts support controlled and uncontrolled?
- [ ] Providers render zero DOM?
- [ ] Where a wrapper would break the DOM, `asChild` via Slot (with Slottable for multi-child)?
