import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 border-border-subtle bg-surface p-5 text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** `as` keeps the page's heading levels in order (h3 by default). */
export function CardTitle({
  as: Heading = "h3",
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <Heading
      className={cn("mb-2 font-display text-lg font-bold", className)}
      {...props}
    />
  );
}
