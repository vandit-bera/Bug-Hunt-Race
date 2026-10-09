import { Suspense } from "react";
import { RoomHeader } from "@/components/room/room-header";
import { RoomLobby } from "@/components/room/room-lobby";
import { RoomsUnavailable } from "@/components/room/rooms-unavailable";
import { Spinner } from "@/components/ui/spinner";
import { isDbConfigured } from "@/lib/rooms/browser-client";

export const metadata = { title: "Room · Bug Hunt Race" };

export default function RoomPage() {
  return (
    <main className="flex w-full flex-1 flex-col p-4 sm:p-6">
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
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <RoomHeader title="Room" />
          <RoomsUnavailable />
        </div>
      )}
    </main>
  );
}
