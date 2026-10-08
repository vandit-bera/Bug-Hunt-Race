"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ROOM_CODE_LENGTH } from "@/lib/game/room-code";
import { lookAlikeHint, sanitizeRoomCodeInput } from "./room-code-input-logic";

export function RoomCodeInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (code: string) => void;
  error?: string;
}) {
  const [hint, setHint] = useState<string>();

  function handleChange(raw: string) {
    const { value: next, rejected } = sanitizeRoomCodeInput(raw);
    setHint(lookAlikeHint(rejected));
    onChange(next);
  }

  return (
    <Input
      label="Room code"
      value={value}
      onChange={(event) => handleChange(event.target.value)}
      error={error}
      hint={hint ?? `${ROOM_CODE_LENGTH} characters, e.g. K7M2QX`}
      placeholder="K7M2QX"
      maxLength={ROOM_CODE_LENGTH * 4}
      autoCapitalize="characters"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      inputMode="text"
      className="font-display text-xl uppercase tracking-[0.3em]"
    />
  );
}
