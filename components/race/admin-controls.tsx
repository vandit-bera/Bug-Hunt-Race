"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  pauseRound,
  resumeRound,
  skipRound,
  stopGame,
  type DbClient,
  type Room,
} from "@/lib/db";
import { roomErrorMessage } from "@/lib/rooms";

type Action = "pause" | "resume" | "skip" | "stop";

const ACTIONS: Record<
  Action,
  (client: DbClient, roomId: string) => Promise<Room>
> = {
  pause: pauseRound,
  resume: resumeRound,
  skip: skipRound,
  stop: stopGame,
};

/**
 * The admin's round controls: Pause / Resume, Skip round and Stop game.
 * Every screen follows the room status over Realtime.
 */
export function AdminControls({
  client,
  room,
}: {
  client: DbClient;
  room: Room;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const paused = room.status === "paused";

  async function act(action: Action) {
    setConfirmStop(false);
    setBusy(action);
    try {
      await ACTIONS[action](client, room.id);
    } catch (caught) {
      toast({ title: roomErrorMessage(caught), variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-label="Admin controls"
      className="flex flex-wrap items-center gap-2"
    >
      {paused ? (
        <Button
          loading={busy === "resume"}
          disabled={busy !== null}
          onClick={() => void act("resume")}
        >
          Resume
        </Button>
      ) : (
        <Button
          variant="secondary"
          loading={busy === "pause"}
          disabled={busy !== null}
          onClick={() => void act("pause")}
        >
          Pause
        </Button>
      )}
      <Button
        variant="secondary"
        loading={busy === "skip"}
        disabled={busy !== null || paused}
        onClick={() => void act("skip")}
      >
        Skip round
      </Button>
      <Button
        variant="danger"
        loading={busy === "stop"}
        disabled={busy !== null}
        onClick={() => setConfirmStop(true)}
      >
        Stop game
      </Button>
      <Modal
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        title="Stop the game?"
      >
        <p className="mb-4">
          This round is scored as it is now, and everyone goes to the final
          leaderboard.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => void act("stop")}>
            Stop game
          </Button>
          <Button variant="secondary" onClick={() => setConfirmStop(false)}>
            Keep playing
          </Button>
        </div>
      </Modal>
    </section>
  );
}
