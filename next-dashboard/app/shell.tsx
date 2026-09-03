"use client";

import { type ReactNode } from "react";
import DashboardShell from "@/components/dashboard-shell";

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

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}
