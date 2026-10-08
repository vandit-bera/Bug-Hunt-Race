import type { Metadata } from "next";
import { RoomLab } from "./room-lab";

export const metadata: Metadata = {
  title: "Room lab · Bug Hunt Race",
  robots: { index: false },
};

/** Dev page for the room engine; the race screens (tasks 3.2–3.5) replace it. */
export default function RoomLabPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Room lab</h1>
        <p className="text-muted">
          Create or join a race room and watch players come and go in real time.
          Open it in two browsers to try it.
        </p>
      </header>
      <RoomLab />
    </main>
  );
}
