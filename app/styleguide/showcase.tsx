"use client";

import { useState } from "react";
import { AnimatedNumber } from "@/components/fx/animated-number";
import { Confetti } from "@/components/fx/confetti";
import { Countdown } from "@/components/fx/countdown";
import { ScorePopup } from "@/components/fx/score-popup";
import { SoundToggle } from "@/components/sound-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge, LevelBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import {
  InvitePanel,
  NameAvatarForm,
  PlayerList,
  RoomCodeInput,
  RoomErrorCard,
  RoomSettingsForm,
  type RoomPlayer,
  type RoomSettings,
} from "@/components/room";
import { RoomFunDemo } from "./room-fun-demo";

const COLOR_TOKENS = [
  "background",
  "surface",
  "surface-raised",
  "border",
  "foreground",
  "muted",
  "primary",
  "accent",
  "success",
  "danger",
  "warning",
  "level-easy",
  "level-medium",
  "level-hard",
];

const SAMPLE_PLAYERS: RoomPlayer[] = [
  { id: "1", name: "Mika", avatar: "🦊", isAdmin: true, connected: true },
  { id: "2", name: "Vandit", avatar: "🐙", isAdmin: false, connected: true },
  { id: "3", name: "Sam", avatar: "🐼", isAdmin: false, connected: false },
  {
    id: "4",
    name: "ABCDEFGHIJKLMNOPQRST",
    avatar: "🦉",
    isAdmin: false,
    connected: true,
  },
  {
    id: "5",
    name: "ABCDEFGHIJKLMNOPQRST (2)",
    avatar: "🐧",
    isAdmin: false,
    connected: true,
  },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export function Showcase({ theme }: { theme: "light" | "dark" }) {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const modalTitle = `${theme} modal`;
  const [locked, setLocked] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [settings, setSettings] = useState<RoomSettings>({
    language: "javascript",
    level: "mixed",
    rounds: 5,
  });
  const [fxRun, setFxRun] = useState(0);
  const [confettiRun, setConfettiRun] = useState(0);

  return (
    <div
      data-theme={theme}
      className="flex flex-col gap-8 rounded-2xl border-2 border-border-subtle bg-background p-4 text-foreground sm:p-6"
    >
      <h2 className="font-display text-2xl font-bold">
        {theme === "light" ? "☀️ Light" : "🌙 Dark"}
      </h2>

      <Section title="Colors">
        <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLOR_TOKENS.map((token) => (
            <li key={token} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className="size-8 shrink-0 rounded-md border-2 border-border"
                style={{ background: `var(--${token})` }}
              />
              <code className="font-mono">{token}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-1">
          <p className="font-display text-3xl font-bold">
            Display: Fix the bug
          </p>
          <p>UI font: Race your team to fix buggy code.</p>
          <p className="font-mono text-muted">mono: const total = a + b;</p>
        </div>
      </Section>

      <Section title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="Badges">
        <Badge>Neutral</Badge>
        <Badge variant="primary">Pass</Badge>
        <Badge variant="accent">Accent</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Fail</Badge>
        <LevelBadge level="easy" />
        <LevelBadge level="medium" />
        <LevelBadge level="hard" />
      </Section>

      <Section title="Avatars">
        <Avatar emoji="🦊" name="Fox" size="sm" />
        <Avatar emoji="🐙" name="Octopus" />
        <Avatar emoji="🦄" name="Unicorn" size="lg" />
      </Section>

      <Section title="Input">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Input
            label="Nickname"
            placeholder="BugSlayer"
            hint="Shown to your team"
          />
          <Input
            label="Room code"
            defaultValue="ABC"
            error="Codes have 6 characters"
          />
        </div>
      </Section>

      <Section title="Card">
        <Card className="w-full max-w-sm">
          <CardTitle>Round 1</CardTitle>
          <p className="text-muted">3 of 5 players have a passing fix.</p>
        </Card>
      </Section>

      <Section title="Fun FX">
        <SoundToggle />
        <Button size="sm" onClick={() => setFxRun((run) => run + 1)}>
          Replay count-up and popup
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setConfettiRun((run) => run + 1)}
        >
          Confetti
        </Button>
        {confettiRun > 0 && <Confetti key={confettiRun} />}
        <p className="font-display text-2xl font-bold">
          <AnimatedNumber key={fxRun} value={250} /> points
        </p>
        <ScorePopup key={`popup-${fxRun}`} points={250} />
        <div className="w-full">
          <Countdown key={`countdown-${fxRun}`} onDone={() => {}} />
        </div>
      </Section>

      <Section title="Spinner, tooltip, toast, modal">
        <Spinner />
        <Tooltip content="Runs your code against the tests">
          <Button variant="secondary" size="sm">
            Hover or focus me
          </Button>
        </Tooltip>
        <Button
          size="sm"
          onClick={() =>
            toast({
              title: "All tests pass",
              description: "Nice fix!",
              variant: "success",
            })
          }
        >
          Show toast
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setModalOpen(true)}
        >
          Open modal
        </Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={modalTitle}
        >
          <p className="mb-4 text-muted">
            Press Escape or the button to close.
          </p>
          <Button onClick={() => setModalOpen(false)}>Got it</Button>
        </Modal>
      </Section>

      <Section title="Room: invite panel">
        <div className="w-full max-w-md">
          <InvitePanel
            roomCode="K7M2QX"
            link="https://bughuntrace.example/join/K7M2QX"
            playerCount={7}
            maxPlayers={30}
            locked={locked}
            onLockChange={setLocked}
          />
        </div>
      </Section>

      <Section title="Room: code input">
        <div className="w-full max-w-sm">
          <RoomCodeInput value={roomCode} onChange={setRoomCode} />
        </div>
      </Section>

      <Section title="Room: name and avatar">
        <div className="w-full max-w-md">
          <NameAvatarForm submitLabel="Join room" onSubmit={() => {}} />
        </div>
      </Section>

      <Section title="Room: player list">
        <div className="w-full max-w-md">
          <PlayerList players={SAMPLE_PLAYERS} selfId="5" />
        </div>
      </Section>

      <Section title="Room: settings">
        <div className="w-full max-w-md">
          <RoomSettingsForm
            idPrefix={`${theme}-settings`}
            value={settings}
            onChange={setSettings}
          />
        </div>
      </Section>

      <Section title="Room: error cards">
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <RoomErrorCard
            kind="not-found"
            action={<Button size="sm">Try another code</Button>}
          />
          <RoomErrorCard
            kind="locked"
            action={<Button size="sm">Back to home</Button>}
          />
          <RoomErrorCard
            kind="full"
            action={<Button size="sm">Back to home</Button>}
          />
          <RoomErrorCard
            kind="disconnected"
            action={<Button size="sm">Reconnect</Button>}
          />
        </div>
      </Section>

      <Section title="Room fun: reactions, solve toasts, live ranks">
        <RoomFunDemo />
      </Section>
    </div>
  );
}
