"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Dziś", icon: "📊" },
  { href: "/rynki", label: "Rynki", icon: "🔎" },
  { href: "/scamy", label: "Scamy", icon: "🛡️" },
  { href: "/archiwum", label: "Archiwum", icon: "📁" },
];

export function BottomNav() {
  const pathname = usePathname();
  // Strony spółek (/spolki/...) należą do zakładki Rynki, a wyniki pomysłów (/pomysly) do zakładki Dziś
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/pomysly") : pathname.startsWith(href) || (href === "/rynki" && pathname.startsWith("/spolki"));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <span className={`text-lg ${active ? "" : "opacity-60 grayscale"}`}>{tab.icon}</span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
