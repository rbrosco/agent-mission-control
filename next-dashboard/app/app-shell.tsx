"use client";

import { type ReactNode } from "react";
import DashboardShell from "@/components/dashboard-shell";

export function AppShell({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
