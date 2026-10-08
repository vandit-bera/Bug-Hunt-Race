/** Loading state of a language's runner, for a loading bar. */
export interface PreloadState {
  status: "idle" | "loading" | "ready" | "error";
  /** 0 to 1. Real download progress for Python; 1 once ready. */
  progress: number;
  error?: string;
}

export const READY_STATE: PreloadState = { status: "ready", progress: 1 };
export const IDLE_STATE: PreloadState = { status: "idle", progress: 0 };

export type PreloadListener = () => void;

/**
 * A tiny external store: `getState` returns a stable object until `setState`
 * replaces it, which is what `useSyncExternalStore` needs.
 */
export class PreloadStore {
  private state: PreloadState = IDLE_STATE;
  private readonly listeners = new Set<PreloadListener>();

  getState = (): PreloadState => this.state;

  subscribe = (listener: PreloadListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setState(state: PreloadState): void {
    this.state = state;
    for (const listener of [...this.listeners]) listener();
  }
}
