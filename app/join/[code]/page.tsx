import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinRoom } from "@/components/room/join-room";
import { RoomTopBar } from "@/components/room/room-top-bar";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Join a room · Bug Hunt Race",
  robots: { index: false },
};

/** Invite links and QR codes open this page. */
export default function JoinRoomPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <RoomTopBar />
      <Suspense fallback={<Spinner label="Loading room" />}>
        <JoinRoom />
      </Suspense>
    </main>
  );
}
