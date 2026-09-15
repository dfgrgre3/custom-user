"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Users" },
  { href: "/sync-history", label: "Sync history" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 border-b border-border">
      {TABS.map((tab) => {
        // The user-detail route (/users/[id]) is reached by clicking a row,
        // not a tab, but it's still part of the "Users" section.
        const isActive =
          tab.href === "/" ? pathname === "/" || pathname.startsWith("/users/") : pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm transition-colors ${
              isActive
                ? "border-accent font-medium text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
