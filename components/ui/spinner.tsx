import { cn } from "./cn";

const sizes = {
  sm: "size-4 border-2",
  md: "size-6 border-[3px]",
  lg: "size-10 border-4",
};

export function Spinner({
  size = "md",
  label = "Loading",
  className,
}: {
  size?: keyof typeof sizes;
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" className="inline-flex">
      <span
        aria-hidden="true"
        className={cn(
          "animate-spin rounded-full border-current border-t-transparent",
          sizes[size],
          className,
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
