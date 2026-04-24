import { SideBySide } from "../../../components/SideBySide";
import { storefrontCopy } from "../copy";
import { siteNav } from "../site-config";

export default function AboutPage() {
  const copy = storefrontCopy.about;

  return (
    <SideBySide nav={siteNav}>
      <div className="section-stack">
        <section className="space-y-4">
          <p className="label">{copy.eyebrow}</p>
          <h1 className="heading-display">{copy.title}</h1>
          <p className="body-copy">{copy.intro}</p>
        </section>

        <hr className="editorial-divider" />

        <section className="grid gap-4 md:grid-cols-3">
          {copy.sections.map((section) => (
            <article key={section.heading} className="surface-card space-y-2">
              <h2 className="text-2xl">{section.heading}</h2>
              <p className="text-sm text-[var(--color-ink-muted)]">{section.body}</p>
            </article>
          ))}
        </section>
      </div>
    </SideBySide>
  );
}
