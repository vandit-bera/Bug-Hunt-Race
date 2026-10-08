"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { QrCode } from "./qr-code";

export function FullscreenQr({
  open,
  onClose,
  roomCode,
  link,
}: {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  link: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Scan to join">
      <div className="flex flex-col items-center gap-4">
        <QrCode
          value={link}
          label={`QR code to join room ${roomCode}`}
          className="w-full max-w-sm"
        />
        <p
          aria-label={`Room code ${roomCode.split("").join(" ")}`}
          className="font-display text-5xl font-bold tracking-[0.3em]"
        >
          {roomCode}
        </p>
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
