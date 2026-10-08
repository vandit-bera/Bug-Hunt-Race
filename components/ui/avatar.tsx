import { cn } from "./cn";

const sizes = {
  sm: "size-8 text-lg",
  md: "size-11 text-2xl",
  lg: "size-16 text-4xl",
};

export function Avatar({
  emoji,
  name,
  size = "md",
}: {
  emoji: string;
  name: string;
  size?: keyof typeof sizes;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-accent bg-surface-raised",
        sizes[size],
      )}
    >
      <span aria-hidden="true">{emoji}</span>
    </span>
  );
}
