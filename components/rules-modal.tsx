"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { HINT_PENALTY_RATIO, MAX_SPEED_BONUS_RATIO } from "@/lib/game/scoring";

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

/** A link-style button that opens the "How scoring works" dialog. */
export function RulesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 items-center font-bold underline ${className ?? ""}`}
      >
        How scoring works
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="How scoring works"
      >
        <ul className="mb-4 flex list-disc flex-col gap-2 pl-5">
          <li>
            <span className="font-bold">Base points:</span> you get them when
            all the tests pass. Harder puzzles are worth more.
          </li>
          <li>
            <span className="font-bold">Speed bonus:</span> up to +
            {percent(MAX_SPEED_BONUS_RATIO)} of the base points. The more time
            you have left, the bigger the bonus.
          </li>
          <li>
            <span className="font-bold">Hint penalty:</span> using the hint
            costs {percent(HINT_PENALTY_RATIO)} of the base points.
          </li>
          <li>
            <span className="font-bold">No fix:</span> time up or giving up
            scores 0.
          </li>
        </ul>
        <p className="mb-4 text-sm text-muted">
          Score = base + speed bonus − hint penalty, never below 0.
        </p>
        <Button onClick={() => setOpen(false)}>Got it</Button>
      </Modal>
    </>
  );
}
