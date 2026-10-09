import { JoinCodeForm } from "@/components/room/join-code-form";
import { RoomHeader } from "@/components/room/room-header";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Join a room · Bug Hunt Race" };

export default function JoinPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <RoomHeader title="Join a room" />
      <p className="text-muted">
        Type the code the admin shared, or open their invite link.
      </p>
      <Card>
        <JoinCodeForm />
      </Card>
    </main>
  );
}
