import { createEffect, createSignal, For } from "solid-js";
import { DropdownMenu } from "./components/dropdown/dropdown";

export function Nav() {
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);

  const navItems = [
    { href: "/work", label: "Work" },
    { href: "/posts", label: "Writing" },
  ];

  createEffect(
    () => isMenuOpen(),
    (isOpen) => {
      const previousBodyOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = isOpen ? "hidden" : previousBodyOverflow;
      document.documentElement.style.overflow = isOpen ? "hidden" : previousHtmlOverflow;
      return () => {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
      };
    },
  );

  return (
    <nav class="relative tracking-tighter px-6 py-4 flex-shrink-0 view-transition-header bg-white dark:bg-[#0a0a0a] z-50">
      <div class="flex items-center justify-between h-16">
        <a class="font-medium" href="/">
          <h1 class="!text-lg">Tom Hackshaw</h1>
        </a>
        <div class="hidden md:flex md:items-center space-x-4 text-lg">
          <For each={navItems}>{(item) => <a href={item.href}>{item.label}</a>}</For>
        </div>
        <div class="md:hidden">
          <DropdownMenu onOpenChange={(open) => setIsMenuOpen(open)}>
            <DropdownMenu.Trigger class="text-lg">Menu</DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <For each={navItems}>
                {(item) => <DropdownMenu.Item href={item.href}>{item.label}</DropdownMenu.Item>}
              </For>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
