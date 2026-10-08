import Link from "next/link";
import { BugVisual } from "@/components/home/bug-visual";
import { RulesButton } from "@/components/rules-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { LEVELS } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { RACE_ROOM_HREF } from "@/lib/game/features";
import { LEVEL_RULES } from "@/lib/puzzles/schema";

const STEPS = [
  { icon: "🔍", title: "Read the code", text: "Find the bug in the snippet." },
  { icon: "🛠️", title: "Fix it", text: "Edit the code and run the tests." },
  { icon: "🏆", title: "Score", text: "Faster correct fixes earn more." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-10 px-4 py-8 text-center sm:px-8">
      <div className="flex w-full justify-end">
        <ThemeToggle />
      </div>

      <section className="flex flex-col items-center gap-4">
        <BugVisual />
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Bug Hunt Race 🐛
        </h1>
        <p className="max-w-md text-lg text-muted">
          Race your team to fix buggy code. Fastest correct fix wins.
        </p>
        <Link href="/solo" className={buttonClass({ size: "lg" })}>
          Solo Practice
        </Link>
        <RaceRoomCard />
      </section>

      <section aria-labelledby="how-to-play" className="w-full">
        <h2 id="how-to-play" className="mb-4 font-display text-2xl font-bold">
          How to play
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="flex h-full flex-col items-center gap-1">
                <span aria-hidden="true" className="text-3xl">
                  {step.icon}
                </span>
                <h3 className="font-display text-lg font-bold">
                  {index + 1}. {step.title}
                </h3>
                <p className="text-sm text-muted">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="levels" className="w-full">
        <h2 id="levels" className="mb-4 font-display text-2xl font-bold">
          Levels
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(LEVELS) as (keyof typeof LEVELS)[]).map((id) => {
            const { label, emoji, color } = LEVELS[id];
            const { timeLimitSec, basePoints } = LEVEL_RULES[id];
            return (
              <li key={id}>
                <Card className="flex h-full flex-col items-center gap-1">
                  <span aria-hidden="true" className="text-3xl">
                    {emoji}
                  </span>
                  <h3 className={cn("font-display text-lg font-bold", color)}>
                    {label}
                  </h3>
                  <p className="text-sm">{timeLimitSec / 60} minutes</p>
                  <p className="text-sm text-muted">{basePoints} base points</p>
                </Card>
              </li>
            );
          })}
        </ul>
        <RulesButton className="mt-2" />
      </section>
    </main>
  );
}

function RaceRoomCard() {
  const body = (
    <>
      <CardTitle>Race Room</CardTitle>
      <p className="text-sm text-muted">
        {RACE_ROOM_HREF ? "Race your team live." : "Coming soon"}
      </p>
    </>
  );
  if (RACE_ROOM_HREF) {
    return (
      <Link href={RACE_ROOM_HREF} className="w-full max-w-sm">
        <Card className="hover:border-accent">{body}</Card>
      </Link>
    );
  }
  return (
    <Card aria-disabled="true" className="w-full max-w-sm opacity-60">
      {body}
    </Card>
  );
}
