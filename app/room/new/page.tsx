import { CreateRoom } from "@/components/room/create-room";
import { RoomHeader } from "@/components/room/room-header";
import { RoomsUnavailable } from "@/components/room/rooms-unavailable";
import { isDbConfigured } from "@/lib/rooms/browser-client";

export const metadata = { title: "Create a room · Bug Hunt Race" };

export default function CreateRoomPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <RoomHeader title="Create a room" />
      {isDbConfigured() ? <CreateRoom /> : <RoomsUnavailable />}
    </main>
  );
}
