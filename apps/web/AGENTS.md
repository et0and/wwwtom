# SolidJS Rules (apps/web)

SolidStart 2.0.0-beta.9 + Vite, solid-js 1.9.

## Mental Model

- MUST: Components = setup functions, run ONCE, not render functions.
- MUST: Reactive work in primitives (`createMemo`, `createEffect`, `<Show>`, `<For>`), not component body.
- MUST: Access signals only inside reactive contexts (JSX expressions, effects, memos).

## Reactivity

- MUST: Call signals as functions: `count()` not `count`.
- MUST: Functional updates when new state depends on old: `setCount((prev) => prev + 1)`.
- MUST: One signal per value — one big state object loses granularity.
- MUST: Derived fns `() => count() * 2` for cheap/infrequent derivations.
- MUST: `createMemo(() => ...)` for expensive/frequent — caches result.
- MUST: `createEffect` for side effects only (DOM, localStorage, subscriptions).
- MUST: `onCleanup(() => ...)` inside effects for subscriptions/intervals/listeners.
- MUST: Store path updates: `setStore("users", 0, "name", "Jane")`.
- MUST: Wrap store props in arrow for `on()`: `on(() => store.value, fn)`, not `on(store.value, fn)`.
- SHOULD: `{ equals: false }` for trigger signals that always notify.
- SHOULD: `batch(() => ...)` for multi-signal updates outside event handlers.
- SHOULD: `on(dep, fn)` for explicit effect deps.
- SHOULD: `untrack(() => value())` to read without subscribing.
- SHOULD: `createStore({ ... })` for nested objects with fine-grained reactivity.
- SHOULD: `produce(draft => ...)` for complex store mutations.
- NEVER: Derive state via `createEffect(() => setX(y()))` — use memo/derived fn.
- NEVER: Side effects inside `createMemo` — infinite loops/crashes.

## Props

- MUST: `props.title`, not destructuring.
- SHOULD: Getter if needed: `const title = () => props.title`.
- SHOULD: `splitProps(props, ["keys"])` local vs pass-through.
- SHOULD: `mergeProps(defaults, props)` for defaults.
- SHOULD: `children(() => props.children)` only when transforming; else `{props.children}`.
- NEVER: Destructure props `({ title })` — breaks reactivity.

## Control Flow

- MUST: `<For each={items()}>` for object arrays — item = value, index = signal.
- MUST: `<Index each={items()}>` for primitives/inputs — item = signal, index = number.
- MUST: `<Suspense fallback={...}>` for async, not `<Show when={!loading}>`.
- MUST: Resource states via `data()`, `data.loading`, `data.error`, `data.latest`.
- SHOULD: `<Show when={cond()} fallback={...}>` for conditionals.
- SHOULD: `<Show when={val}>` callback for type narrowing: `{(v) => <div>{v().name}</div>}`.
- SHOULD: `<Switch>/<Match>` for multiple conditions.
- SHOULD: `createResource(source, fetcher)` for reactive async data.
- SHOULD: `<ErrorBoundary fallback={(err, reset) => ...}>` for render errors.
- NEVER: `.map()` in JSX — use `<For>`/`<Index>`.
- NEVER: ErrorBoundary for event handler or setTimeout errors — use try/catch.

## JSX & DOM

- MUST: `class` not `className`.
- MUST: Static `class="btn"` + reactive `classList={{ active: isActive() }}`.
- MUST: `onClick` for delegated events; `on:click` for native (element-level).
- MUST: Condition inside handler — events not reactive: `onClick={() => props.onClick?.()}`.
- MUST: Read refs in `onMount` or effects — refs connect after render.
- MUST: `onCleanup` inside directives.
- SHOULD: `on:click` for `stopPropagation`, capture, passive, custom events.
- SHOULD: Inline styles incl. CSS vars: `style={{ color: color(), "--css-var": value() }}`.
- SHOULD: Type refs `let el: HTMLElement | undefined` with guard.
- SHOULD: `use:directiveName={accessor}` for reusable DOM behaviors.
- NEVER: Mix reactive `class={x()}` with `classList`.
