import * as stylex from "@stylexjs/stylex";
import { createEffect, createSignal, For, Show } from "solid-js";
import { fontSizeLg } from "./styles/typography.stylex";

const MD = "@media (min-width: 768px)";

const styles = stylex.create({
  nav: {
    position: "relative",
    letterSpacing: "-0.025em",
    paddingInline: "1.5rem",
    paddingBlock: "1rem",
    flexShrink: 0,
    zIndex: 50,
    [MD]: { position: "sticky", top: 0 },
  },
  bar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "4rem",
  },
  brand: { fontWeight: 500 },
  brandHeading: {
    fontSize: fontSizeLg.fontSize,
    lineHeight: fontSizeLg.lineHeight,
  },
  links: {
    display: "none",
    gap: "1rem",
    fontSize: fontSizeLg.fontSize,
    lineHeight: fontSizeLg.lineHeight,
    [MD]: { display: "flex", alignItems: "center" },
  },
  menuButton: {
    fontSize: fontSizeLg.fontSize,
    lineHeight: fontSizeLg.lineHeight,
    [MD]: { display: "none" },
  },
  dropdown: {
    display: "block",
    [MD]: { display: "none" },
  },
  dropdownInner: {
    display: "flex",
    flexDirection: "column",
    paddingBlock: "1rem",
    paddingInline: "1.5rem",
    fontSize: "2.25rem",
    lineHeight: "2.5rem",
  },
});

/** `view-transition-name` has no StyleX equivalent; the hook class lives in apps/web/src/app.css. */
const generatedNavAttrs = stylex.attrs(styles.nav);
const navAttrs = {
  ...generatedNavAttrs,
  class: ["view-transition-header", generatedNavAttrs.class].filter(Boolean).join(" "),
};

/** Positioning for the open mobile menu lives in apps/web/src/app.css (`.nav-dropdown`). */
const generatedDropdownAttrs = stylex.attrs(styles.dropdown);
const dropdownAttrs = {
  ...generatedDropdownAttrs,
  class: ["nav-dropdown", generatedDropdownAttrs.class].filter(Boolean).join(" "),
};

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
    <nav {...navAttrs}>
      <div {...stylex.attrs(styles.bar)}>
        <a {...stylex.attrs(styles.brand)} href="/">
          <h1 {...stylex.attrs(styles.brandHeading)}>Tom Hackshaw</h1>
        </a>
        <div {...stylex.attrs(styles.links)}>
          <For each={navItems}>{(item) => <a href={item.href}>{item.label}</a>}</For>
        </div>
        <button {...stylex.attrs(styles.menuButton)} onClick={() => setIsOpen(!isOpen())}>
          Menu
        </button>
      </div>
      <Show when={isOpen()}>
        <div {...dropdownAttrs}>
          <div {...stylex.attrs(styles.dropdownInner)}>
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
