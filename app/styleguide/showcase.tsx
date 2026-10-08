"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, LevelBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";

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

  return (
    <div
      data-theme={theme}
      className="flex flex-col gap-8 rounded-2xl border-2 border-border-subtle bg-background p-6 text-foreground"
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
    </div>
  );
}
