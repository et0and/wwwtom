import type { SideBySideNav } from "../../components/SideBySide";

export const siteTitle = "Grace Chapel Studios";
export const siteDescription =
  "Grace Chapel Studios — handcrafted goods, shipped within New Zealand.";
export const siteMetadata = {
  title: { default: siteTitle, template: `%s | ${siteTitle}` },
  description: siteDescription,
};
export const siteNav: SideBySideNav = {
  homeHref: "/",
  title: siteTitle,
  shortTitle: "GCS",
  links: [
    { href: "/about", label: "About" },
    { href: "/products", label: "Shop" },
  ],
};
