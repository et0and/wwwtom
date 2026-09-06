# Solid Rules (apps/web, apps/editor)

Solid 2.0 (`solid-js@2.0.0-rc.6`) + Vite. No SolidStart package, no 1.x APIs:
`onMount`, `createResource`, `batch`, `on`, `mergeProps`, `splitProps`,
`Suspense`, `ErrorBoundary`, `Index`, `classList`, `produce`,
`createComputed`, `startTransition` are all gone. `Effect.catchAll` is gone
too — Effect 4 calls it `Effect.catch`.

## Mental Model

- MUST: Components = setup functions, run ONCE, not render functions.
- MUST: Reactive work in primitives (`createMemo`, `createEffect`, `<Show>`, `<For>`), not component body.
- MUST: Access signals only inside reactive contexts (JSX expressions, effects, memos).
- MUST: Prefer `createMemo` for shared derivations read from JSX; plain
  helpers that read signals also track, but memos cache expensive work.
- MUST: `onSettled(fn)` for mount work (fetching, third-party widgets like
  Tiptap). Return the cleanup from the callback; there is no `onMount`.
- MUST: Writes flush async (microtask batching, no `batch()`). Read the
  committed value after a flush, never read-modify-write across callbacks —
  each callback sees the last committed value, so rapid updates lose writes.
  Prefer self-contained updates over `setX(x() + 1)` chains.

## Reactivity

- MUST: Call signals as functions: `count()` not `count`.
- MUST: One signal per value — one big state object loses granularity.
- MUST: Derived fns `() => count() * 2` for cheap/infrequent derivations.
- MUST: `createMemo(() => ...)` for expensive/frequent — caches result.
- MUST: `createEffect(compute, effect)` takes TWO functions in 2.0:
  `createEffect(() => count(), (count) => doWork(count))`. Single-arg
  `createEffect(() => ...)` throws. Side effects only — never set state there.
- MUST: `onCleanup(() => ...)` inside effects for subscriptions/intervals/listeners.
- MUST: Store path updates: `setStore("users", 0, "name", "Jane")`.
- SHOULD: `untrack(() => value())` to read without subscribing.
- SHOULD: `createStore({ ... })` for nested objects with fine-grained reactivity.
- NEVER: Derive state via an effect that sets signals — use memo/derived fn.
- NEVER: Side effects inside `createMemo` — infinite loops/crashes.
- NEVER: `createResource`, `batch`, `on`, `mergeProps`, `splitProps`,
  `produce`, `createComputed` — none exist in 2.0.

## Props

- MUST: `props.title`, not destructuring.
- SHOULD: Getter if needed: `const title = () => props.title`.
- SHOULD: `merge(source, defaults)` for defaults; `omit(props, ...keys)`
  for local-vs-rest (replaces `mergeProps`/`splitProps`).
- SHOULD: `children(() => props.children)` only when transforming; else `{props.children}`.
- NEVER: Destructure props `({ title })` — breaks reactivity.

## Control Flow

- MUST: `<For each={items()}>` for lists (objects and primitives);
  `<Index>` is gone. `keyed` prop controls identity.
- MUST: `<Loading fallback={...}>` for async, not `<Show when={!loading}>`;
  `<Suspense>` is gone.
- MUST: Server state via `@tanstack/solid-query` (web pattern) or
  signal + `<Loading>`; `createResource` is gone.
- SHOULD: `<Show when={cond()} fallback={...}>` for conditionals.
- SHOULD: `<Show when={val}>` callback for type narrowing: `{(v) => <div>{v().name}</div>}`.
- SHOULD: `<Switch>/<Match>` for multiple conditions.
- SHOULD: `<Errored fallback={(err, reset) => ...}>` for render errors;
  `<ErrorBoundary>` is gone.
- NEVER: `.map()` in JSX — use `<For>`.
- NEVER: Errored for event handler or setTimeout errors.

## JSX & DOM

- MUST: `class` not `className`; `classList` is gone.
- MUST: Static `class="btn"` + reactive template string with direct reads:
  `class={isActive() ? "btn on" : "btn"}`.
- MUST: Boolean attributes take strings: `aria-pressed={on() ? "true" : "false"}`
  (raw booleans serialize as `""`).
- MUST: `onClick` for delegated events; `on:click` for native (element-level).
- MUST: Condition inside handler — events not reactive: `onClick={() => props.onClick?.()}`.
- MUST: Read refs in `onSettled` — refs connect after render. Callback form
  `ref={(el) => { element = el; }}`.
- MUST: `onCleanup` inside directives.
- SHOULD: `on:click` for `stopPropagation`, capture, passive, custom events.
- SHOULD: Inline styles incl. CSS vars: `style={{ color: color(), "--css-var": value() }}`.
- SHOULD: Type refs `let el: HTMLElement | undefined` with guard.
- SHOULD: `use:directiveName={accessor}` for reusable DOM behaviors.

## Tests

- MUST: `await` signal flushes — writes commit async, so assert state with
  `vi.waitFor`, not immediately after the action.
- MUST: Name test files `*.test.tsx` — `.ts` files skip the JSX transform.
