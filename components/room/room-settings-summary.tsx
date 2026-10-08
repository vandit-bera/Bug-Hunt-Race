import { LEVELS } from "@/components/ui/badge";
import type { DbLanguage, RoomLevel } from "@/lib/db";
import { LANGUAGES } from "@/lib/runner/config";

/** A room's settings as plain facts, e.g. for players waiting in the lobby. */
export function RoomSettingsSummary({
  language,
  level,
  totalRounds,
}: {
  language: DbLanguage;
  level: RoomLevel;
  /** null = until the admin stops; leave out when unknown. */
  totalRounds?: number | null;
}) {
  const items = [
    { term: "Language", value: LANGUAGES[language].label },
    { term: "Level", value: level === "mixed" ? "Mixed" : LEVELS[level].label },
  ];
  if (totalRounds !== undefined) {
    items.push({
      term: "Rounds",
      value: totalRounds === null ? "Until the admin stops" : `${totalRounds}`,
    });
  }
  return (
    <dl
      aria-label="Room settings"
      className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2"
    >
      {items.map(({ term, value }) => (
        <div
          key={term}
          className="rounded-lg border-2 border-border-subtle bg-surface p-3"
        >
          <dt className="text-sm text-muted">{term}</dt>
          <dd className="font-bold break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
