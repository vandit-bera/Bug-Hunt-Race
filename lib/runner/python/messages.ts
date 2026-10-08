/** What the Python worker tells the page while it boots. */
export type WorkerEvent =
  | { type: "progress"; value: number }
  | { type: "ready" }
  | { type: "failed"; error: string };
