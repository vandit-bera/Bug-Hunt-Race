"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Shown on small screens only; the player can dismiss it and carry on. */
export function LaptopBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div
      role="note"
      className="flex flex-col gap-2 rounded-lg border-2 border-warning p-3 text-sm md:hidden"
    >
      <p>
        💻 Bug Hunt Race is best on a laptop. You can still play here, but
        typing code on a small screen is hard.
      </p>
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => setDismissed(true)}
      >
        Continue anyway
      </Button>
    </div>
  );
}
