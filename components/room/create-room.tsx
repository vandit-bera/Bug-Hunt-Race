"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { DbError, createRoom, ensureSignedIn } from "@/lib/db";
import { getBrowserDbClient, roomErrorMessage, roomHref } from "@/lib/rooms";
import { NameAvatarForm } from "./name-avatar-form";
import type { PlayerProfile } from "./name-avatar";
import type { RoomSettings } from "./room-settings";
import { RoomSettingsForm } from "./room-settings-form";

const DEFAULT_SETTINGS: RoomSettings = {
  language: "javascript",
  level: "easy",
  rounds: 5,
};

/** Create Room: settings, then the admin's name and avatar. */
export function CreateRoom() {
  const router = useRouter();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();

  async function create(profile: PlayerProfile) {
    setBusy(true);
    setError(null);
    setNameError(undefined);
    try {
      const client = getBrowserDbClient();
      await ensureSignedIn(client);
      const { room } = await createRoom(client, {
        language: settings.language,
        level: settings.level,
        totalRounds: settings.rounds,
        displayName: profile.name,
        avatar: profile.avatar,
      });
      // Stays busy until the lobby replaces this screen.
      router.push(roomHref(room.code));
    } catch (caught) {
      const message = roomErrorMessage(caught);
      if (caught instanceof DbError && caught.code === "invalid_display_name") {
        setNameError(message);
      } else {
        setError(message);
      }
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardTitle as="h2">Game settings</CardTitle>
        <RoomSettingsForm value={settings} onChange={setSettings} />
      </Card>
      <Card>
        <CardTitle as="h2">You (admin)</CardTitle>
        <NameAvatarForm
          submitLabel="Create room"
          loading={busy}
          onSubmit={create}
          nameError={nameError}
          onNameChange={() => setNameError(undefined)}
        />
        {error && (
          <p role="alert" className="mt-4 font-bold text-danger">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
