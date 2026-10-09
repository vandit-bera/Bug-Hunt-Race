import type { Metadata } from "next";
import { Crash } from "./crash";

export const metadata: Metadata = {
  title: "Crash test · Bug Hunt Race",
  robots: { index: false },
};

/** Dev page that crashes on purpose, so E2E can check app/error.tsx. */
export default function CrashPage() {
  return <Crash />;
}
