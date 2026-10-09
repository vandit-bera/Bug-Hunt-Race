import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinRoom } from "@/components/room/join-room";
import { RoomHeader } from "@/components/room/room-header";
import { RoomsUnavailable } from "@/components/room/rooms-unavailable";
import { Spinner } from "@/components/ui/spinner";
import { isDbConfigured } from "@/lib/rooms/browser-client";

export const metadata: Metadata = {
  title: "Join a room · Bug Hunt Race",
  robots: { index: false },
};

/** Invite links and QR codes open this page. */
export default function JoinRoomPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <RoomHeader title="Join a room" />
      {isDbConfigured() ? (
        <Suspense
          fallback={
            <Spinner
              size="lg"
              label="Loading the room"
              className="self-center"
            />
          }
        >
          <JoinRoom />
        </Suspense>
      ) : (
        <RoomsUnavailable />
      )}
    </main>
  );
}
