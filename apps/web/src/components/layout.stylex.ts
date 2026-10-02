import * as stylex from "@stylexjs/stylex";

/**
 * One-off layout styles for app-level call sites. TomUI components take a
 * `style` prop of StyleX styles, so a caller that needs a single margin or
 * display tweak passes one of these instead of a Tailwind class.
 */
export const layoutStyles = stylex.create({
  mt2: { marginTop: "0.5rem" },
  mt1: { marginTop: "0.25rem" },
  mb1: { marginBottom: "0.25rem" },
  mb2: { marginBottom: "0.5rem" },
  mb3: { marginBottom: "0.75rem" },
  mb4: { marginBottom: "1rem" },
  block: { display: "block" },
  /** 24px heading, for the wait-timer readout. */
  text2xl: { fontSize: "1.5rem", lineHeight: "2rem" },
  /** Fixed row height for the virtualised number list. */
  itemHeight: (height: string) => ({ height }),
});

/**
 * `banner-title` was a semantic class in app.css, styled for a <Text>. StyleX
 * styles cannot reach an element by class name, so it lives here instead.
 */
export const bannerTitleStyles = stylex.create({
  bannerTitle: {
    fontSize: "0.875rem",
    fontWeight: 600,
    letterSpacing: "-0.05em",
    backgroundColor: {
      default: "rgb(230, 216, 226)",
      "@media (prefers-color-scheme: dark)": "rgb(75, 60, 70)",
    },
    padding: "0.25rem 0.5rem",
    flexShrink: 0,
  },
  /** Guestbook message body colour, also lifted out of app.css. */
  guestbookMessage: {
    color: {
      default: "#374151",
      "@media (prefers-color-scheme: dark)": "#d1d5db",
    },
  },
  /** Centred 404 message. */
  notFound: { textAlign: "center", margin: "0 auto", padding: "1rem" },
});
