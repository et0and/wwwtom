import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import { storefrontCopy } from "@/app/(frontend)/copy";
import "./(frontend)/styles.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export default function GlobalNotFound() {
  const copy = storefrontCopy.fallbacks.notFound;

  return (
    <html lang="en" className={cormorant.variable}>
      <body>
        <main className="page-shell content-container section-layout flex items-center justify-center">
          <div className="surface-card section-stack max-w-xl text-center">
            <p className="label">404</p>
            <h1 className="heading-section">{copy.title}</h1>
            <p className="body-copy mx-auto text-base">{copy.body}</p>
            <div>
              <Link href="/products" className="button-primary">
                {copy.shopLabel}
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
