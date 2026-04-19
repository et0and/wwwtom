"use client";

import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import { storefrontCopy } from "@/app/(frontend)/copy";
import "./(frontend)/styles.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

type Props = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function GlobalError(props: Props) {
  const copy = storefrontCopy.fallbacks.error;

  return (
    <html lang="en" className={cormorant.variable}>
      <body>
        <main className="page-shell content-container section-layout flex items-center justify-center">
          <div className="surface-card section-stack max-w-xl text-center">
            <p className="label">Storefront error</p>
            <h1 className="heading-section">{copy.title}</h1>
            <p className="body-copy mx-auto text-base">{copy.body}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={props.reset} type="button" className="button-primary">
                {copy.retryLabel}
              </button>
              <Link href="/" className="button-secondary">
                {copy.homeLabel}
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
