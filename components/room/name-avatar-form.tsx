"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/input";
import {
  AVATAR_EMOJIS,
  NAME_MAX_LENGTH,
  loadProfile,
  saveProfile,
  validateName,
  type PlayerProfile,
} from "./name-avatar";

export function NameAvatarForm({
  onSubmit,
  submitLabel = "Continue",
  loading = false,
  nameError,
  onNameChange,
}: {
  onSubmit: (profile: PlayerProfile) => void;
  submitLabel?: string;
  loading?: boolean;
  /** A name the server refused, shown on the field. */
  nameError?: string;
  /** Called as the player edits the name, e.g. to clear `nameError`. */
  onNameChange?: () => void;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_EMOJIS[0]);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    const saved = loadProfile();
    if (!saved) return;
    // Reading localStorage is only possible after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(saved.name);
    setAvatar(saved.avatar);
  }, []);

  const error = validateName(name);

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (error) {
          setShowError(true);
          return;
        }
        const profile = { name: name.trim(), avatar };
        saveProfile(profile);
        onSubmit(profile);
      }}
    >
      <Input
        label="Your name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          onNameChange?.();
        }}
        maxLength={NAME_MAX_LENGTH + 10}
        autoComplete="nickname"
        placeholder="BugSlayer"
        error={(showError && error) || nameError}
        hint={`1 to ${NAME_MAX_LENGTH} characters`}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">Pick an avatar</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {AVATAR_EMOJIS.map((emoji) => (
            <label key={emoji} className="relative flex justify-center">
              <input
                type="radio"
                name="avatar"
                value={emoji}
                aria-label={`Avatar ${emoji}`}
                checked={avatar === emoji}
                onChange={() => setAvatar(emoji)}
                className="peer absolute inset-0 cursor-pointer appearance-none opacity-0"
              />
              <span
                className={cn(
                  "rounded-full ring-offset-2 ring-offset-surface",
                  "peer-checked:ring-4 peer-checked:ring-primary",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring",
                )}
              >
                <Avatar emoji={emoji} name={emoji} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" loading={loading}>
        {submitLabel}
      </Button>
    </form>
  );
}
