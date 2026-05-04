import type { SideBySideNav } from "../../components/SideBySide";
import { storefrontCopy } from "./copy";

export const siteTitle = storefrontCopy.nav.brand;
export const siteDescription =
  "Grandma Hope — handmade knitwear and crochet, crafted one at a time in New Zealand.";
export const siteMetadata = {
  title: { default: siteTitle, template: `%s | ${siteTitle}` },
  description: siteDescription,
};
export const siteNav: SideBySideNav = {
  homeHref: "/",
  title: siteTitle,
  shortTitle: storefrontCopy.nav.shortBrand,
  links: storefrontCopy.nav.links,
};
