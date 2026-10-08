"use client";

import { LEVELS } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { LANGUAGES } from "@/lib/runner/config";
import type { Level } from "@/lib/game/types";
import type { LanguageId } from "@/lib/runner/types";
import { ROUND_OPTIONS, type RoomSettings } from "./room-settings";

const LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];
const LEVEL_OPTIONS: { id: Level; label: string }[] = [
  { id: "easy", label: LEVELS.easy.label },
  { id: "medium", label: LEVELS.medium.label },
  { id: "hard", label: LEVELS.hard.label },
  { id: "mixed", label: "Mixed" },
];

function Choice({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="relative">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer absolute inset-0 cursor-pointer opacity-0"
      />
      <span
        className={cn(
          "flex h-full items-center justify-center rounded-lg border-2 border-border-subtle bg-surface px-3 py-2 text-center font-display font-bold",
          "hover:border-accent peer-checked:border-primary peer-checked:bg-surface-raised",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
        )}
      >
        {label}
      </span>
    </label>
  );
}

export function RoomSettingsForm({
  value,
  onChange,
  idPrefix = "room-settings",
}: {
  value: RoomSettings;
  onChange: (settings: RoomSettings) => void;
  /** Keeps radio groups apart when two forms are on one page. */
  idPrefix?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Language</legend>
        <div className="grid grid-cols-3 gap-2">
          {LANGUAGE_IDS.map((id) => (
            <Choice
              key={id}
              name={`${idPrefix}-language`}
              label={LANGUAGES[id].label}
              checked={value.language === id}
              onChange={() => onChange({ ...value, language: id })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Level</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEVEL_OPTIONS.map((option) => (
            <Choice
              key={option.id}
              name={`${idPrefix}-level`}
              label={option.label}
              checked={value.level === option.id}
              onChange={() => onChange({ ...value, level: option.id })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Rounds</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROUND_OPTIONS.map((option) => (
            <Choice
              key={option.label}
              name={`${idPrefix}-rounds`}
              label={option.label}
              checked={value.rounds === option.value}
              onChange={() => onChange({ ...value, rounds: option.value })}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
