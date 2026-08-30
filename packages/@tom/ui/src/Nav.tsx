import { createSignal, For, Show } from "solid-js";

export function Nav() {
  const [isOpen, setIsOpen] = createSignal(false);

  const navItems = [
    { href: "/work", label: "Work" },
    { href: "/posts", label: "Writing" },
  ];

  return (
    <nav class="relative tracking-tighter px-6 py-4 flex-shrink-0 view-transition-header bg-white dark:bg-[#0a0a0a] z-50">
      <div class="flex items-center justify-between h-16">
        <a class="font-medium" href="/">
          <h1 class="!text-lg">Tom Hackshaw</h1>
        </a>
        <div class="hidden md:flex md:items-center space-x-4 text-lg">
          <For each={navItems}>{(item) => <a href={item.href}>{item.label}</a>}</For>
        </div>
        <button class="md:hidden p-2" onClick={() => setIsOpen(!isOpen())} aria-label="Toggle menu">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            {isOpen() ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </>
            )}
          </svg>
        </button>
      </div>
      <Show when={isOpen()}>
        <div class="nav-dropdown md:hidden">
          <div class="flex flex-col py-4 px-6 text-lg">
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
