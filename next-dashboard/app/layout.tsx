import { AppShell } from "./app-shell";
import Script from "next/script";
import "./globals.css";

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is scoped to THIS element only (does not
    // propagate to children) and is the documented Next.js fix for a
    // <html>/<body> class toggled by an inline pre-hydration script: the
    // classList.add("dark") in THEME_INIT_SCRIPT runs before React attaches,
    // so server and client HTML legitimately differ on this one attribute
    // by design (theme must apply before first paint to avoid a flash of
    // wrong theme) — this tells React that specific mismatch is expected
    // instead of logging it as a real bug on every single page.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className="bg-cream dark:bg-inkdeep text-ink dark:text-cream antialiased min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
