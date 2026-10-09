"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ROOM_CODE_LENGTH, isValidRoomCode } from "@/lib/game/room-code";
import { RoomCodeInput } from "./room-code-input";

/** The `/join` form: a valid code goes on to `/join/<code>`. */
export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValidRoomCode(code)) {
          setError(`Enter all ${ROOM_CODE_LENGTH} characters of the code.`);
          return;
        }
        router.push(`/join/${code}`);
      }}
    >
      <RoomCodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          setError(undefined);
        }}
        error={error}
      />
      <Button type="submit" size="lg">
        Join
      </Button>
    </form>
  );
}
