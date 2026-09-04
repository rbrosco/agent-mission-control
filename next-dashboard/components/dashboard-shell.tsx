"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Clock } from "./clock";
import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/chat", label: "Chat" },
  { href: "/tasks", label: "Tasks" },
  { href: "/office", label: "Office" },
  { href: "/content", label: "Content" },
  { href: "/schedule", label: "Schedule" },
  { href: "/docs", label: "Docs" },
] as const;

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <div className="sticky top-0 z-50 bg-cream/90 dark:bg-inkdeep/90 backdrop-blur border-b border-black/5 dark:border-white/10">
        <div className="max-w-[1500px] mx-auto px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
            <span className="font-serif text-lg font-semibold tracking-tight">Hermes</span>
            <span className="text-[10px] uppercase tracking-wider bg-black/5 dark:bg-white/5 text-black/50 dark:text-white/50 px-1.5 py-0.5 rounded-full font-sans">
              next
            </span>
          </div>

          <nav className="flex-1 flex items-center justify-center gap-1 flex-wrap">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`nav-pill px-4 py-2 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    active
                      ? "bg-black/90 text-cream dark:bg-white/15 dark:text-white"
                      : "text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <CommandPalette items={NAV_ITEMS} />
            <ThemeToggle />
            <Clock />
          </div>
        </div>
      </div>

      <main className="max-w-[1500px] mx-auto px-6 py-8">{children}</main>
    </>
  );
}
