import type { Metadata } from "next";
import Link from "next/link";
import { storefrontCopy } from "@/app/(frontend)/copy";
import { siteNav } from "@/app/(frontend)/site-config";
import { SideBySide } from "@/components/SideBySide";

export const metadata: Metadata = {
  title: "Order confirmed",
};

export default function SuccessPage() {
  const copy = storefrontCopy.success;

  return (
    <SideBySide nav={siteNav}>
      <div className="section-stack max-w-2xl">
        <p className="label">{copy.eyebrow}</p>
        <h1 className="heading-section text-[2.5rem]">{copy.title}</h1>
        <p className="body-copy">{copy.body}</p>
        <div>
          <Link href={copy.cta.href} className="button-primary">
            {copy.cta.label}
          </Link>
        </div>
      </div>
    </SideBySide>
  );
}
