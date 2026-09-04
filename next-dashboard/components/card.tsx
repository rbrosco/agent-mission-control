import { type HTMLAttributes, forwardRef } from "react";

/**
 * Shared surface used across the dashboard for metric tiles, panels, and
 * list containers. Centralizes the card visual language (bg, radius,
 * border, shadow, dark mode) so it only needs to change in one place.
 * Pass `hover` to opt into the card-hover lift (see globals.css).
 */
export const Card = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { hover?: boolean }
>(function Card({ className = "", hover = false, children, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={[
        "bg-card dark:bg-cardd rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/10",
        hover ? "card-hover" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
});

/** Small uppercase eyebrow label used at the top of most Card instances. */
export function CardLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-xs uppercase tracking-wider text-black/40 dark:text-white/40 ${className}`}>
      {children}
    </div>
  );
}
