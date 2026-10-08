import type { Metadata } from "next";
import { Suspense } from "react";
import { RoomLobby } from "@/components/room/room-lobby";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Room · Bug Hunt Race",
  robots: { index: false },
};

export default function RoomPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <Suspense fallback={<Spinner label="Loading room" />}>
        <RoomLobby />
      </Suspense>
    </main>
  );
}
