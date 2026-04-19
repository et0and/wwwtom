import Link from "next/link";
import { storefrontCopy } from "@/app/(frontend)/copy";

interface FooterProps {
  year?: number;
}

function getFooterYear() {
  return new Date().getFullYear();
}

export const Footer = (props: FooterProps) => {
  const year = props.year ?? getFooterYear();

  return (
    <footer className="border-t border-[var(--color-border)] py-10">
      <div className="content-container space-y-8">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="space-y-3">
            <p className="label">{storefrontCopy.footer.newsletterLabel}</p>
            <p className="heading-section text-[1.9rem]">{storefrontCopy.nav.brand}</p>
            <p className="body-copy text-base">{storefrontCopy.footer.tagline}</p>
            <p className="text-sm text-[var(--color-ink-muted)]">
              {storefrontCopy.footer.newsletterBody}
            </p>
          </div>

          {storefrontCopy.footer.columns.map((column) => (
            <div key={column.title} className="space-y-3">
              <p className="label">{column.title}</p>
              <ul className="space-y-2">
                {column.links.map((item) => (
                  <li key={item.href + item.label}>
                    <Link href={item.href} className="link text-sm text-[var(--color-ink-muted)]">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr className="editorial-divider" />

        <div className="flex flex-col gap-3 text-xs text-[var(--color-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            {storefrontCopy.footer.legal.copyrightLead} {year}
          </p>
          <div className="flex gap-4">
            {storefrontCopy.footer.legal.links.map((item) => (
              <Link key={item.label} href={item.href} className="link">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
