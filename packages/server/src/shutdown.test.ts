/**
 * A signal stops it, with a browser attached — and names itself first.
 *
 * This is a real child process rather than a scope closed in this one, because
 * the bugs it exists for lived in the seam between the two. The first: `runMain`
 * caught the signal and began unwinding, every finalizer that had anything to
 * say ran, and the process still never exited. A scope closed in-process would
 * have hung the test runner instead of failing it, and an in-process test that
 * passed would have proved only that the finalizer returns — not that Node had
 * anything left to do afterwards. The second: `runMain` treats the interrupt
 * as a successful stop and writes nothing, so a journal of a 130 cannot tell a
 * signaled death from `systemctl stop`. The line has to come from this process,
 * on this signal, before the unwind.
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

import { startWeb, stoppedWithin } from "./child.testlib.ts"
import { served } from "./serve.testlib.ts"

/** How long a shutdown may take before it is a hang. Generous: what is being
 *  told apart is "under a second" from "never". */
const BOUND_MS = 10_000

/** Boot, attach one tab, deliver `signal`, and say what the child did. A hang
 *  throws here — with the signal and the bound — rather than coming back as a
 *  value the assertion would have to name. */
const signaled = async (signal: "SIGINT" | "SIGTERM"): Promise<{
  readonly code: number | null
  readonly said: string
}> => {
  const server = startWeb({ root: served() })
  try {
    const url = await server.address()
    const socket = new WebSocket(`${url.replace("http://", "ws://")}/rpc/ws`)
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve())
      socket.addEventListener("error", () => reject(new Error("the socket did not open")))
    })

    server.kill(signal)
    const code = await Promise.race([
      server.exited(),
      Bun.sleep(BOUND_MS).then(() => {
        throw new Error(`${signal} did not stop the child within ${BOUND_MS}ms`)
      }),
    ])
    return { code, said: server.said() }
  } finally {
    server.kill()
  }
}

test("SIGINT stops a server that a browser is connected to", async () => {
  const { code, said } = await signaled("SIGINT")
  expect(code).toBe(130)
  expect(said).toContain("olai web: received SIGINT")
  // Longer than the bound this test measures, so a hang fails on the
  // assertion — which says what happened — rather than on the runner's own
  // timeout, which says only that something took too long.
}, BOUND_MS * 3)

test("SIGTERM names itself on stderr and exits 130", async () => {
  const { code, said } = await signaled("SIGTERM")
  expect(code).toBe(130)
  expect(said).toContain("olai web: received SIGTERM")
}, BOUND_MS * 3)

test("olai web exits when its served directory disappears", async () => {
  const root = served()
  const server = startWeb({ root })
  try {
    await server.address()
    fs.rmSync(root, { recursive: true, force: true })
    expect(await stoppedWithin(server.child, BOUND_MS)).toBe(true)
  } finally {
    server.kill()
  }
}, BOUND_MS * 3)

test("olai web dies when its parent dies", async () => {
  // `prctl(PR_SET_PDEATHSIG)`: SIGKILL of cucumber used to reparent every
  // detached server to init. A wrapper process is the parent here; killing
  // it must take the server with it.
  if (process.platform !== "linux") return
  const root = served()
  const wrapper = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "olai-parent-")), "parent.mjs")
  fs.writeFileSync(
    wrapper,
    `import { spawn } from "node:child_process";
const child = spawn(process.execPath, process.argv.slice(2), {
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});
process.stdout.write("child=" + child.pid + "\\n");
child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);
setInterval(() => {}, 1 << 30);
`,
  )
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "olai-parent-dist-"))
  fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html>\n")
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "olai-parent-run-"))
  const parent = spawn(
    process.execPath,
    [wrapper, path.join(import.meta.dirname, "main.ts"), "web", root, "--no-commit"],
    {
      env: {
        ...process.env,
        OLAI_DIST_DIR: dist,
        OLAI_ACP_AGENT: "",
        OLAI_LOG: "logfmt",
        XDG_RUNTIME_DIR: runtime,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  let said = ""
  parent.stdout?.setEncoding("utf8")
  parent.stderr?.setEncoding("utf8")
  parent.stdout?.on("data", (chunk: string) => {
    said += chunk
  })
  parent.stderr?.on("data", (chunk: string) => {
    said += chunk
  })
  try {
    const started = Date.now()
    while (!said.includes("message=serving") && Date.now() - started < BOUND_MS) {
      await Bun.sleep(25)
    }
    expect(said).toContain("message=serving")
    const childPid = Number(/^child=(\d+)$/m.exec(said)?.[1])
    expect(childPid).toBeGreaterThan(0)
    parent.kill("SIGKILL")
    await Bun.sleep(500)
    expect(() => process.kill(childPid, 0)).toThrow()
  } finally {
    parent.kill("SIGKILL")
  }
}, BOUND_MS * 3)
