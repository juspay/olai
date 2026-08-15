/**
 * Ctrl+C stops it, with a browser attached.
 *
 * This is the whole of the test, and it is a real child process rather than a
 * scope closed in this one, because the bug it exists for lived in the seam
 * between the two: `runMain` caught the signal and began unwinding, every
 * finalizer that had anything to say ran, and the process still never exited.
 * A scope closed in-process would have hung the test runner instead of failing
 * it, and an in-process test that passed would have proved only that the
 * finalizer returns — not that Node had anything left to do afterwards, which
 * is exactly what was wrong.
 *
 * The websocket is not incidental. `server.close` waits for every open
 * connection, an idle server has none, and so a server nobody had opened
 * stopped instantly for as long as anyone tested it that way. One connected
 * tab is the ordinary case and was the broken one.
 */

import { expect, test } from "bun:test"

import { startWeb, stoppedWithin } from "./child.testlib.ts"
import { served } from "./serve.testlib.ts"

/** How long a shutdown may take before it is a hang. Generous: what is being
 *  told apart is "under a second" from "never". */
const BOUND_MS = 10_000

test("SIGINT stops a server that a browser is connected to", async () => {
  const server = startWeb({ root: served() })

  try {
    const url = await server.address()
    const socket = new WebSocket(`${url.replace("http://", "ws://")}/rpc/ws`)
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve())
      socket.addEventListener("error", () => reject(new Error("the socket did not open")))
    })

    server.kill("SIGINT")
    expect(await stoppedWithin(server.child, BOUND_MS)).toBe(true)
  } finally {
    server.kill()
  }
  // Longer than the bound this test measures, so a hang fails on the
  // assertion — which says what happened — rather than on the runner's own
  // timeout, which says only that something took too long.
}, BOUND_MS * 3)
