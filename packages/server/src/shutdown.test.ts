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
import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { stoppedWithin } from "./child.testlib.ts"

const MAIN = path.join(import.meta.dirname, "main.ts")

/** How long a shutdown may take before it is a hang. Generous: what is being
 *  told apart is "under a second" from "never". */
const BOUND_MS = 10_000

/** A directory to serve, and one to pretend is the built client — the entry
 *  point refuses to start without an `index.html` to hand out. */
const scratch = (): { readonly root: string; readonly dist: string } => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "olai-shutdown-"))
  const root = path.join(base, "root")
  const dist = path.join(base, "dist")
  fs.mkdirSync(root)
  fs.mkdirSync(dist)
  fs.writeFileSync(path.join(root, "a.jsonl"), `{"id":"a","ord":"a0","title":"a"}\n`)
  fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html>\n")
  return { root, dist }
}

test("SIGINT stops a server that a browser is connected to", async () => {
  const { dist, root } = scratch()
  const child = spawn(
    process.execPath,
    [MAIN, "web", root, "--port", "0", "--no-commit"],
    {
      env: {
        ...process.env,
        OLAI_DIST_DIR: dist,
        // No agent: the subject is the listener, and a real one would make
        // this test depend on a model and a network.
        OLAI_ACP_AGENT: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  try {
    const url = await addressOf(child)
    const socket = new WebSocket(`${url.replace("http://", "ws://")}/rpc/ws`)
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve())
      socket.addEventListener("error", () => reject(new Error("the socket did not open")))
    })

    child.kill("SIGINT")
    expect(await stoppedWithin(child, BOUND_MS)).toBe(true)
  } finally {
    child.kill("SIGKILL")
  }
  // Longer than the bound this test measures, so a hang fails on the
  // assertion — which says what happened — rather than on the runner's own
  // timeout, which says only that something took too long.
}, BOUND_MS * 3)

/** Where it says it is serving. Read off stdout because that IS the interface —
 *  the port was asked for as `0`, so the process is the only thing that knows
 *  which one it got. */
const addressOf = (child: ReturnType<typeof spawn>): Promise<string> =>
  new Promise((resolve, reject) => {
    let said = ""
    const timer = setTimeout(
      () => reject(new Error(`the server never said where it was serving:\n${said}`)),
      BOUND_MS,
    )
    child.stdout?.on("data", (chunk: Buffer) => {
      said += String(chunk)
      const found = /^serving .* on (http:\/\/\S+)$/m.exec(said)
      if (found === null) return
      clearTimeout(timer)
      resolve(found[1]!)
    })
    child.stderr?.on("data", (chunk: Buffer) => {
      said += String(chunk)
    })
  })
