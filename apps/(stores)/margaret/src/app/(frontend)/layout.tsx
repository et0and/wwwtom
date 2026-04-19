import React from "react";
import { Cormorant_Garamond } from "next/font/google";
import "./styles.css";
import { siteMetadata } from "./site-config";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata = siteMetadata;

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props;

  return (
    <html lang="en" className={cormorant.variable}>
      <body>{children}</body>
    </html>
  );
}
