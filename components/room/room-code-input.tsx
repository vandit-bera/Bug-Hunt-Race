"use client";

import { useEffect, useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(raw: string) {
    const { value: next, rejected } = sanitizeRoomCodeInput(raw);
    setHint(lookAlikeHint(rejected));
    onChange(next);
  }

  // Text typed or pasted before hydration stays in the box, but React never
  // sees it, and it ignores the same text entered again (TB-78). Pick it up
  // once, so a slow page doesn't show a code that Join then calls empty.
  useEffect(() => {
    const typed = inputRef.current?.value ?? "";
    if (typed !== value) handleChange(typed);
    // Only the text from before hydration; later edits go through onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Input
      ref={inputRef}
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
      className="w-full min-w-0 font-display text-xl uppercase tracking-[0.2em] sm:tracking-[0.3em]"
    />
  );
}
