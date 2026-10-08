"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border-2 border-border bg-surface p-0 text-foreground backdrop:bg-black/60 open:animate-[modal-in_150ms_ease-out]"
    >
      <div className="p-6">
        <h2 id={titleId} className="mb-3 font-display text-xl font-bold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
