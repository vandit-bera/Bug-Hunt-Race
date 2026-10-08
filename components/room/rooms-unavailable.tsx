import { Card, CardTitle } from "@/components/ui/card";

/** Shown when the app has no Supabase project to keep rooms in. */
export function RoomsUnavailable() {
  return (
    <Card role="alert">
      <CardTitle as="h2">Rooms are not available</CardTitle>
      <p className="text-muted">
        This site is not connected to a database yet. Solo Practice still works.
      </p>
    </Card>
  );
}
