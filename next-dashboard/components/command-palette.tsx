"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type CommandItem = {
  href: string;
  label: string;
};

export function CommandPalette({ items }: { items: readonly CommandItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q)
    );
  }, [items, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  // Global shortcut: Cmd+K (mac) / Ctrl+K (win/linux) toggles the palette.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isCombo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isCombo) {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Focus the input and reset selection whenever the palette opens.
  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      const id = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => window.cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (results.length ? (prev - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) navigate(target.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir busca de navegação (Cmd+K)"
        className="hidden md:flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-full px-3 py-1.5 text-xs text-black/40 dark:text-white/40 w-56 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
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
        <span className="ml-auto text-[10px] font-mono bg-white dark:bg-white/10 rounded px-1 py-0.5 border border-black/10 dark:border-white/15">
          ⌘K
        </span>
      </button>

      {open ? (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/40 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Paleta de comandos de navegação"
            className="w-full max-w-lg rounded-2xl bg-card dark:bg-cardd border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-black/10 dark:border-white/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 text-black/40 dark:text-white/40 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search agents, missions, logs..."
                aria-label="Buscar página de navegação"
                className="flex-1 bg-transparent outline-none text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
              />
              <span className="text-[10px] font-mono bg-black/5 dark:bg-white/10 rounded px-1 py-0.5 border border-black/10 dark:border-white/15 text-black/40 dark:text-white/40">
                Esc
              </span>
            </div>

            <ul role="listbox" aria-label="Resultados" className="max-h-80 overflow-y-auto py-2">
              {results.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-black/40 dark:text-white/40">
                  Nenhum resultado para “{query}”
                </li>
              ) : (
                results.map((item, index) => (
                  <li key={item.href} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                        index === activeIndex
                          ? "bg-accent/10 text-accent"
                          : "text-black/70 dark:text-white/70"
                      }`}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="text-[11px] font-mono text-black/30 dark:text-white/30">
                        {item.href}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
