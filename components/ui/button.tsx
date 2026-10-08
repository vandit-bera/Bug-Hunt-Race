import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";
import { Spinner } from "./spinner";

const variants = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover shadow-press",
  secondary:
    "bg-surface-raised text-foreground border-2 border-border hover:border-accent shadow-press",
  ghost: "bg-transparent text-foreground hover:bg-surface-raised",
  danger: "bg-danger text-danger-foreground hover:brightness-110 shadow-press",
};

const sizes = {
  sm: "h-9 px-3 text-sm tap:h-11 tap:min-w-11",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

/** Button styles for other elements, e.g. a link that looks like a button. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-display font-bold tracking-wide transition-[transform,box-shadow,background-color,filter] duration-100",
    "hover:-translate-y-px active:translate-y-[3px] active:shadow-none",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner size="sm" label="Loading" />}
      {children}
    </button>
  );
}
