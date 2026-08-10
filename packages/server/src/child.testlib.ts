/**
 * "Did that process stop?", as a bounded question.
 *
 * Two tests in this package start a real olai and then ask it to stop — one by
 * a signal (`shutdown.test.ts`, the SIGINT regression), one by closing the
 * pipe an MCP client owns (`mcp/serve.test.ts`). Both are telling the same two
 * outcomes apart, and it is a distinction a bare `await` cannot make: a
 * process that never stops does not fail a test, it hangs it, and the runner's
 * own timeout then reports only that something took too long.
 *
 * So the answer is a BOOLEAN with a deadline, and the caller asserts on it —
 * which is what puts "it did not stop" in the failure message instead of in
 * the runner's summary. Written twice before this file existed, and the two
 * copies had already drifted onto different events.
 */

import type { ChildProcess } from "node:child_process"

/**
 * Wait for `child` to be gone, or answer `false` after `ms`.
 *
 * `close` rather than `exit`, and the difference is load-bearing for one of
 * the two callers: `exit` fires when the process is gone, `close` when its
 * stdio has been drained as well, so a test that reads what the child SAID is
 * guaranteed to have all of it. It costs the other caller nothing — a stopped
 * process closes its pipes — and one event is one fewer thing for the two to
 * disagree about.
 *
 * Call it in the same synchronous block as whatever asks the child to stop:
 * the listener is attached here, and an exit that has already happened has no
 * event left to emit.
 */
export const stoppedWithin = (child: ChildProcess, ms: number): Promise<boolean> =>
  Promise.race([
    new Promise<boolean>((resolve) => {
      child.on("close", () => resolve(true))
    }),
    Bun.sleep(ms).then(() => false),
  ])
