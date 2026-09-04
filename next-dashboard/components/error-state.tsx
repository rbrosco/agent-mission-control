"use client";

/**
 * Shared error state for pages that fetch from the Mission Control backend.
 * Replaces bare red text with a design-consistent card + retry action, so a
 * failed fetch doesn't look broken relative to the rest of the polished UI.
 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-card dark:bg-cardd rounded-2xl p-8 shadow-sm border border-black/5 dark:border-white/10 flex flex-col items-center text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-red-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="text-sm font-semibold">Não foi possível carregar os dados</div>
      <div className="text-xs text-black/50 dark:text-white/50 max-w-sm">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 text-[11px] uppercase tracking-wider font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition-colors rounded-full px-4 py-2"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
