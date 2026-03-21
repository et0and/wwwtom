"use client";

import React, { useState } from "react";

interface MobileNavProps {
  children: React.ReactNode;
}

export const MobileNav = ({ children }: MobileNavProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Header - always visible */}
      <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-medium lowercase">Sophie Tremaine</h1>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -mr-2"
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </header>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu - hide the h1 from children */}
      {isOpen && (
        <nav className="lg:hidden fixed inset-0 z-50 bg-white pt-16 pointer-events-none">
          <div className="p-4 pointer-events-auto [&>h1]:hidden" onClick={() => setIsOpen(false)}>
            {children}
          </div>
        </nav>
      )}
    </>
  );
};
