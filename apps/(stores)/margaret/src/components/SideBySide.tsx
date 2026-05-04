import Link from "next/link";
import { storefrontCopy } from "@/app/(frontend)/copy";
import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { SkipLink } from "./SkipLink";

export interface SideBySideNavLink {
  href: string;
  label: string;
}

export interface SideBySideNav {
  homeHref: string;
  title: string;
  shortTitle: string;
  links: ReadonlyArray<SideBySideNavLink>;
}

interface SideBySideProps {
  nav: SideBySideNav;
  footer?: ReactNode;
  children: ReactNode;
}

export const SideBySide = (props: SideBySideProps) => {
  const footer = props.footer ?? <Footer />;

  return (
    <div className="page-shell">
      <SkipLink label={storefrontCopy.nav.skipToContent} />

      <header className="top-nav">
        <div className="content-container">
          <div className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex items-center justify-start border-r border-[var(--color-border)] py-4 pr-4">
              <nav aria-label="Primary navigation">
                {props.nav.links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="link text-sm font-semibold tracking-wide"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <Link href={props.nav.homeHref} className="link px-2 text-center text-2xl leading-none">
              {props.nav.title}
            </Link>

            <div className="border-l border-[var(--color-border)] py-4 pl-4" aria-hidden="true" />
          </div>
        </div>
      </header>

      <main id="main" className="content-container section-layout">
        {props.children}
      </main>
      {footer}
    </div>
  );
};
