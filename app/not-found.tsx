import type { Metadata } from "next";
import Link from "next/link";
import { ErrorScreen } from "@/components/error-screen";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found · Bug Hunt Race" };

export default function NotFound() {
  return (
    <ErrorScreen
      emoji="🔍"
      title="Page not found"
      description="This page doesn't exist. The link may be old or mistyped."
      actions={
        <>
          <Link href="/" className={buttonClass()}>
            Home
          </Link>
          <Link href="/solo" className={buttonClass({ variant: "secondary" })}>
            Solo Practice
          </Link>
        </>
      }
    />
  );
}
