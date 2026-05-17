import Link from "next/link";
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
    <div className="mx-auto min-h-screen lg:flex lg:max-w-[1800px]">
      <div className="hidden border-gray-200 lg:block lg:border-r">
        <div className="top-0 w-full px-12 py-4 lg:sticky lg:h-screen lg:py-9 xl:px-28">
          <nav className="flex flex-col gap-4">
            <h1 className="text-xl font-medium lowercase">
              <Link href={props.nav.homeHref} className="link">
                {props.nav.title}
              </Link>
            </h1>
            <div className="mt-4">
              {props.nav.links.map((item) => (
                <Link prefetch={true} key={item.href} href={item.href} className="block py-2 link">
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>

      <div className="flex min-h-screen flex-1 flex-col">
        <SkipLink />
        <div className="flex items-center justify-between border-b border-gray-200 bg-white lg:hidden px-4 py-3">
          <Link href={props.nav.homeHref} className="text-xl font-medium lowercase link">
            {props.nav.shortTitle}
          </Link>

          <details className="relative">
            <summary
              aria-label="Toggle navigation menu"
              className="list-none cursor-pointer [&::-webkit-details-marker]:hidden"
            >
              <span aria-hidden="true" className="flex flex-col gap-1">
                <span className="block h-px w-5 bg-current" />
                <span className="block h-px w-5 bg-current" />
                <span className="block h-px w-5 bg-current" />
              </span>
            </summary>

            <nav className="absolute right-0 top-full border-b border-gray-200 bg-white px-4 py-4">
              <div className="flex flex-col gap-3">
                {props.nav.links.map((item) => (
                  <Link
                    prefetch={true}
                    key={item.href}
                    href={item.href}
                    className="block py-2 link"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </details>
        </div>

        <main id="main" className="flex-1 px-12 py-8 xl:px-28 lg:py-9">
          {props.children}
        </main>
        {footer}
      </div>
    </div>
  );
};
