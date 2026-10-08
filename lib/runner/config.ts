import type { LanguageConfig, LanguageId } from "./types";

export const DEFAULT_RUN_TIMEOUT_MS = 5_000;

/** Output beyond this is cut so a print loop cannot freeze the page. */
export const MAX_OUTPUT_CHARS = 10_000;

export const LANGUAGES: Record<LanguageId, LanguageConfig> = {
  javascript: {
    id: "javascript",
    label: "JavaScript",
    monacoLanguage: "javascript",
    fileExtension: "js",
  },
  typescript: {
    id: "typescript",
    label: "TypeScript",
    monacoLanguage: "typescript",
    fileExtension: "ts",
  },
  python: {
    id: "python",
    label: "Python",
    monacoLanguage: "python",
    fileExtension: "py",
  },
};
