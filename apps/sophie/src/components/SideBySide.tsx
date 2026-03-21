import React from "react";
import { Footer } from "./Footer";
import { SkipLink } from "./SkipLink";

interface SideBySideProps {
  left: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const SideBySide = ({ left, footer, children }: SideBySideProps) => {
  const footerContent = footer ?? <Footer />;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:max-w-[1800px] mx-auto">
      <div className="mb-3 lg:mb-0 lg:border-r border-gray-200">
        <div className="top-0 w-full px-12 lg:sticky py-4 lg:h-screen xl:px-28 lg:py-9">{left}</div>
      </div>

      <div className="flex-1 flex flex-col">
        <SkipLink />
        <main id="main" className="flex-grow px-12 xl:px-28 lg:py-9">
          {children}
        </main>
        {footerContent}
      </div>
    </div>
  );
};
