import { Card, CardTitle } from "@/components/ui/card";
import { readSupabaseConfig } from "@/lib/db/config";

/**
 * Shown when the app has no Supabase project to keep rooms in. In `next dev`
 * it also says which variable is wrong (never its value).
 */
export function RoomsUnavailable() {
  const config = readSupabaseConfig();
  const problem =
    process.env.NODE_ENV === "development" && !config.ok && !config.missing
      ? config.problem
      : null;
  return (
    <Card role="alert">
      <CardTitle as="h2">Rooms are not available</CardTitle>
      <p className="text-muted">
        This site is not connected to a database yet. Solo Practice still works.
      </p>
      {problem && <p className="text-sm text-danger">{problem}</p>}
    </Card>
  );
}
