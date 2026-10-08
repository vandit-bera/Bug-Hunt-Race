import { Card } from "@/components/ui/card";
import { JoinCodeForm } from "@/components/room/join-code-form";
import { RoomTopBar } from "@/components/room/room-top-bar";

export const metadata = { title: "Join a room · Bug Hunt Race" };

export default function JoinPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <RoomTopBar />
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">Join a room</h1>
        <p className="text-muted">
          Type the code the admin shared, or open their invite link.
        </p>
      </header>
      <Card>
        <JoinCodeForm />
      </Card>
    </main>
  );
}
