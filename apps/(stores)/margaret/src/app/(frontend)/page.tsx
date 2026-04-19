import { SideBySide } from "../../components/SideBySide";
import Link from "next/link";
import { storefrontCopy } from "./copy";
import { siteNav } from "./site-config";

export default function HomePage() {
  const copy = storefrontCopy.home;

  return (
    <SideBySide nav={siteNav}>
      <div className="section-stack">
        <section className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <div className="space-y-5">
            <p className="label">{copy.eyebrow}</p>
            <h1 className="heading-display">{copy.title}</h1>
            <p className="body-copy">{copy.intro}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={copy.primaryCta.href} className="button-primary">
                {copy.primaryCta.label}
              </Link>
              <Link href={copy.secondaryCta.href} className="button-secondary">
                {copy.secondaryCta.label}
              </Link>
            </div>
          </div>
          <aside className="surface-card space-y-3">
            <p className="label">{copy.noteLabel}</p>
            <p className="text-sm text-[var(--color-ink-muted)]">{copy.noteBody}</p>
          </aside>
        </section>

        <hr className="editorial-divider" />

        <section className="grid gap-4 md:grid-cols-3">
          {copy.highlights.map((highlight) => (
            <article key={highlight.title} className="surface-card space-y-2">
              <p className="label">{highlight.number}</p>
              <h2 className="text-2xl">{highlight.title}</h2>
              <p className="text-sm text-[var(--color-ink-muted)]">{highlight.body}</p>
            </article>
          ))}
        </section>
      </div>
    </SideBySide>
  );
}
