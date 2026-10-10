"use client";

import "monaco-editor/languages/definitions/javascript/register";
import "monaco-editor/languages/definitions/typescript/register";
import "monaco-editor/languages/definitions/python/register";
import "monaco-editor/editor/browser/coreCommands";
import "monaco-editor/editor/browser/widget/codeEditor/codeEditorWidget";
import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching";
import "monaco-editor/editor/contrib/clipboard/browser/clipboard";
import "monaco-editor/editor/contrib/comment/browser/comment";
import "monaco-editor/editor/contrib/contextmenu/browser/contextmenu";
import "monaco-editor/editor/contrib/find/browser/findController";
import "monaco-editor/editor/contrib/folding/browser/folding";
import "monaco-editor/editor/contrib/indentation/browser/indentation";
import "monaco-editor/editor/contrib/linesOperations/browser/linesOperations";
import "monaco-editor/editor/contrib/multicursor/browser/multicursor";
import "monaco-editor/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode";
import "monaco-editor/editor/contrib/wordOperations/browser/wordOperations";
import * as monaco from "monaco-editor/editor/editor.api";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Spinner } from "@/components/ui/spinner";

/**
 * Monaco is bundled with the app (no CDN) and only the editor worker is
 * started: syntax colours come from the basic language definitions, so there
 * are no type-checker squiggles that would point at the bug. Only the editor
 * features a short fix needs are imported, to keep the chunk small.
 */
self.MonacoEnvironment = {
  getWorker: () =>
    new Worker(
      new URL("monaco-editor/editor/editor.worker.js", import.meta.url),
      { type: "module" },
    ),
};
loader.config({ monaco });

function useDataTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

// Same breakpoint as Tailwind's `sm` and the `tap` variant.
const PHONE_QUERY = "(width < 40rem)";

function subscribePhone(listener: () => void) {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** True on phone widths, where long lines would hide behind a side scroll. */
function usePhoneWidth(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

export interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  /** Called on Ctrl/Cmd+Enter inside the editor. */
  onRun: () => void;
  readOnly?: boolean;
}

export default function CodeEditor({
  value,
  language,
  onChange,
  onRun,
  readOnly = false,
}: CodeEditorProps) {
  const theme = useDataTheme();
  const phone = usePhoneWidth();
  const onRunRef = useRef(onRun);
  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  const onMount: OnMount = (editor) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      onRunRef.current(),
    );
  };

  return (
    <Editor
      value={value}
      language={language}
      theme={theme === "dark" ? "vs-dark" : "vs"}
      onChange={(next) => onChange(next ?? "")}
      onMount={onMount}
      loading={<Spinner label="Loading editor" />}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "var(--font-geist-mono), monospace",
        tabSize: 2,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        wordBasedSuggestions: "off",
        parameterHints: { enabled: false },
        // Phones: wrap long lines and give the code the gutter's width.
        wordWrap: phone ? "on" : "off",
        folding: !phone,
        lineNumbersMinChars: phone ? 2 : 5,
        lineDecorationsWidth: phone ? 4 : 10,
        ariaLabel: "Code editor",
      }}
    />
  );
}
