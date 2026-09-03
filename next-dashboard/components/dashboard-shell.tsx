import { type ReactNode } from "react";
import { Clock } from "./clock";
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
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="nav-pill px-4 py-2 rounded-full text-[11px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 hover:text-black"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-full px-3 py-1.5 text-xs text-black/40 dark:text-white/40 w-56">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span className="truncate">Search agents, missions, logs...</span>
              <span className="ml-auto text-[10px] font-mono bg-white dark:bg-white/10 rounded px-1 py-0.5 border border-black/10 dark:border-white/15">⌘K</span>
            </div>
            <ThemeToggle />
            <Clock />
          </div>
        </div>
      </div>

      <main className="max-w-[1500px] mx-auto px-6 py-8">{children}</main>
    </>
  );
}
