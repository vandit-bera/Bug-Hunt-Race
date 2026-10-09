import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/**
 * Full-page message for the app's error, 404 and global-error pages: a big
 * emoji, a heading, one line of help and the action buttons. Never shows the
 * error itself (no stack traces for players).
 */
export function ErrorScreen({
  emoji,
  title,
  description,
  actions,
}: {
  emoji: string;
  title: string;
  description: string;
  /** Buttons or links, e.g. Retry and Home. */
  actions: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12">
      <Card
        role="alert"
        className="flex flex-col items-center gap-4 p-8 text-center"
      >
        <span aria-hidden="true" className="text-6xl">
          {emoji}
        </span>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="max-w-sm text-muted">{description}</p>
        <div className="flex flex-wrap justify-center gap-3">{actions}</div>
      </Card>
    </main>
  );
}
