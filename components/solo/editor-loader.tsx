"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";

/** Monaco is large and browser-only, so it loads on demand. */
export const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner label="Loading editor" />
    </div>
  ),
});
