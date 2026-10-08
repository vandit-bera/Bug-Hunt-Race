import { Suspense } from "react";
import { RoomHeader } from "@/components/room/room-header";
import { RoomLobby } from "@/components/room/room-lobby";
import { RoomsUnavailable } from "@/components/room/rooms-unavailable";
import { Spinner } from "@/components/ui/spinner";
import { isDbConfigured } from "@/lib/rooms/browser-client";

export const metadata = { title: "Room · Bug Hunt Race" };

export default function RoomPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
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
          <RoomLobby />
        </Suspense>
      ) : (
        <>
          <RoomHeader title="Room" />
          <RoomsUnavailable />
        </>
      )}
    </main>
  );
}
