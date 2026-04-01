import type { Metadata } from "next";
import type { SideBySideNav } from "../../components/SideBySide";

export const siteTitle = "Sophie Tremaine";
export const siteDescription = "Personal website of Sophie Tremaine";

export const siteMetadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
};

export const siteNav = {
  homeHref: "/",
  title: siteTitle,
  shortTitle: "ST",
  links: [
    { href: "/about", label: "About" },
    { href: "/posts", label: "Posts" },
  ],
} as const satisfies SideBySideNav;
