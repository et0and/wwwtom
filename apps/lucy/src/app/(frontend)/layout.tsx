import React from "react";
import { EB_Garamond } from "next/font/google";
import "./styles.css";
import { siteMetadata } from "./site-config";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata = siteMetadata;

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props;

  return (
    <html lang="en" className={ebGaramond.variable}>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
