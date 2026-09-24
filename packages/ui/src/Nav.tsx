import { createEffect, createSignal, For, Show } from "solid-js";

export function Nav() {
  const [isOpen, setIsOpen] = createSignal(false);

  const navItems = [
    { href: "/work", label: "Work" },
    { href: "/posts", label: "Writing" },
  ];

  createEffect(
    () => isOpen(),
    (isMenuOpen) => {
      const previousBodyOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = isMenuOpen ? "hidden" : previousBodyOverflow;
      document.documentElement.style.overflow = isMenuOpen ? "hidden" : previousHtmlOverflow;
      return () => {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
      };
    },
  );

  return (
    <nav class="relative md:sticky md:top-0 tracking-tighter px-6 py-4 flex-shrink-0 view-transition-header z-50">
      <div class="flex items-center justify-between h-16">
        <a class="font-medium" href="/">
          <h1 class="!text-lg">Tom Hackshaw</h1>
        </a>
        <div class="hidden md:flex md:items-center space-x-4 text-lg">
          <For each={navItems}>{(item) => <a href={item.href}>{item.label}</a>}</For>
        </div>
        <button class="md:hidden text-lg" onClick={() => setIsOpen(!isOpen())}>
          Menu
        </button>
      </div>
      <Show when={isOpen()}>
        <div class="nav-dropdown md:hidden">
          <div class="flex flex-col py-4 px-6 text-4xl">
            <For each={navItems}>
              {(item) => (
                <a href={item.href} onClick={() => setIsOpen(false)}>
                  {item.label}
                </a>
              )}
            </For>
          </div>
        </div>
      </Show>
    </nav>
  );
}
