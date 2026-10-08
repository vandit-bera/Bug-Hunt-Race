import { SandboxRunner } from "@/lib/runner/sandbox-runner";
import { pythonPool } from "./browser-pool";

/** Browser Python runner: every run takes a booted worker from the pool. */
export class PythonRunner extends SandboxRunner {
  constructor() {
    super("python", (request) => pythonPool.open(request));
  }

  /** Stops runs in flight and releases the spare Pyodide worker. */
  override dispose(): void {
    super.dispose();
    pythonPool.dispose();
  }
}
