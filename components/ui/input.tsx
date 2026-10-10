import { useId, type InputHTMLAttributes, type Ref } from "react";
import { cn } from "./cn";

export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
  label: string;
  hint?: string;
  error?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          "h-11 w-full min-w-0 rounded-lg border-2 bg-surface px-3 text-foreground placeholder:text-muted",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-danger" : "border-border focus:border-accent",
          className,
        )}
        {...props}
      />
      {message && (
        <p
          id={messageId}
          className={cn("text-sm", error ? "text-danger" : "text-muted")}
        >
          {message}
        </p>
      )}
    </div>
  );
}
