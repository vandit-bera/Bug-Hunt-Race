"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./cn";

type ToastVariant = "info" | "success" | "danger";
type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};
type ToastItem = ToastInput & { id: number };

const TOAST_DURATION_MS = 5000;
const accents: Record<ToastVariant, string> = {
  info: "border-accent",
  success: "border-success",
  danger: "border-danger",
};

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>");
  return toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { ...input, id }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-[toast-in_200ms_ease-out] items-start gap-3 rounded-lg border-2 bg-surface-raised p-3 text-foreground",
              accents[item.variant ?? "info"],
            )}
          >
            <div className="flex-1">
              <p className="font-bold">{item.title}</p>
              {item.description && (
                <p className="text-sm text-muted">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(item.id)}
              className="rounded px-1.5 text-lg leading-none text-muted hover:text-foreground"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
