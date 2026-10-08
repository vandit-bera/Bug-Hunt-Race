"use client";

import { useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { FullscreenQr } from "./fullscreen-qr";
import { QrCode } from "./qr-code";

export interface InvitePanelProps {
  roomCode: string;
  link: string;
  playerCount: number;
  maxPlayers: number;
  locked: boolean;
  onLockChange: (locked: boolean) => void;
}

export function InvitePanel({
  roomCode,
  link,
  playerCount,
  maxPlayers,
  locked,
  onLockChange,
}: InvitePanelProps) {
  const toast = useToast();
  const linkId = useId();
  const linkRef = useRef<HTMLInputElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyFailed(false);
      toast({ title: "Copied! ✅", variant: "success" });
    } catch {
      setCopyFailed(true);
      linkRef.current?.focus();
      linkRef.current?.select();
    }
  }

  async function shareLink() {
    try {
      await navigator.share({ title: "Bug Hunt Race", url: link });
    } catch {
      // The player closed the share sheet; nothing to do.
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="mb-0">Invite players</CardTitle>
        <Badge variant={playerCount >= maxPlayers ? "danger" : "accent"}>
          <span aria-hidden="true">👥</span>
          <span aria-label={`${playerCount} of ${maxPlayers} players`}>
            {playerCount} / {maxPlayers}
          </span>
        </Badge>
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-sm text-muted">Room code</span>
        <p
          aria-label={`Room code ${roomCode.split("").join(" ")}`}
          className="font-display text-5xl font-bold tracking-[0.3em] sm:text-6xl"
        >
          {roomCode}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={linkId} className="text-sm font-bold">
          Invite link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={linkId}
            ref={linkRef}
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-lg border-2 border-border bg-surface px-3 font-mono text-sm text-foreground focus:border-accent"
          />
          <div className="flex gap-2">
            <Button onClick={copyLink}>Copy</Button>
            {canShare && (
              <Button variant="secondary" onClick={shareLink}>
                Share
              </Button>
            )}
          </div>
        </div>
        {copyFailed && (
          <p role="status" className="text-sm text-warning">
            Couldn&apos;t copy automatically. The link is selected: press Ctrl+C
            (⌘C on Mac).
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <QrCode
          value={link}
          label={`QR code to join room ${roomCode}`}
          className="w-40"
        />
        <Button variant="ghost" size="sm" onClick={() => setQrOpen(true)}>
          Show full-screen QR
        </Button>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-border-subtle p-3">
        <input
          type="checkbox"
          role="switch"
          checked={locked}
          onChange={(event) => onLockChange(event.target.checked)}
          className="size-5 accent-primary"
        />
        <span className="flex flex-col">
          <span className="font-bold">Lock room</span>
          <span className="text-sm text-muted">
            {locked ? "Nobody new can join." : "Anyone with the code can join."}
          </span>
        </span>
      </label>

      <FullscreenQr
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        roomCode={roomCode}
        link={link}
      />
    </Card>
  );
}
