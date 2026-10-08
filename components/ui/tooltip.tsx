"use client";

import {
  cloneElement,
  useEffect,
  useId,
  useState,
  type ReactElement,
} from "react";
import { cn } from "./cn";

export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(false);

  // Escape must work for hover too (WCAG 1.4.13), where focus is not inside.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active]);

  const describedBy = [children.props["aria-describedby"], id]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className="group relative inline-flex"
      onMouseEnter={() => setActive(true)}
      onFocus={() => setActive(true)}
      onBlur={() => {
        setActive(false);
        setDismissed(false);
      }}
      onMouseLeave={() => {
        setActive(false);
        setDismissed(false);
      }}
    >
      {cloneElement(children, { "aria-describedby": describedBy })}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-56 -translate-x-1/2 rounded-md border-2 border-border bg-surface-raised px-2.5 py-1.5 text-xs text-foreground opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
          dismissed && "!opacity-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}
