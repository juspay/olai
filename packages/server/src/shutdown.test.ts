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
 * WHO this server dies with — the kernel's parent-death signal, and the
 * daemonising wrapper it must NOT die with — is `./dieWithParent.test.ts`,
 * which holds both outcomes side by side. One of them used to be a test here;
 * a signal arriving on the kernel's behalf is a different subject from what
 * this process does with a signal somebody sent it.
 *
 * The websocket is not incidental. `server.close` waits for every open
 * connection, an idle server has none, and so a server nobody had opened
 * stopped instantly for as long as anyone tested it that way. One connected
 * tab is the ordinary case and was the broken one.
 */

import { expect, test } from "bun:test"
import { spawn } from "node:child_process"

import { startWeb } from "./child.testlib.ts"
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

/** Poll until `predicate` holds or `ms` runs out — the failure names what
 *  never happened rather than what the runner clocked. */
const until = async (ms: number, what: string, predicate: () => boolean): Promise<void> => {
  const deadline = Date.now() + ms
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`${what} never happened within ${ms}ms`)
    await Bun.sleep(20)
  }
}

/** The first line a helper process writes, or a throw naming what it said
 *  instead (stdout is drained from spawn, so no wait can miss the line). */
const firstLineOf = (proc: ReturnType<typeof spawn>): Promise<string> =>
  new Promise((resolve, reject) => {
    let box = ""
    proc.stdout?.setEncoding("utf8")
    proc.stdout?.on("data", (chunk: string) => {
      box += chunk
      const breakAt = box.indexOf("\n")
      if (breakAt >= 0) resolve(box.slice(0, breakAt).trim())
    })
    proc.on("exit", (code) => reject(new Error(`helper exited (${code}) without a pid line; it said: ${box}`)))
  })

test("a SIGTERM from anyone but the supervisor is refused and named; the server keeps serving", async () => {
  // The guard is Linux-only (the supervisor it recognizes is systemd's
  // user manager); everywhere else keeps the default disposition.
  if (process.platform !== "linux") return
  const server = startWeb({ root: served() })
  try {
    const url = await server.address()
    const pid = server.pid
    expect(pid).toBeGreaterThan(0)

    await until(BOUND_MS, "the guard arming", () => server.said().includes("SIGTERM guard armed"))

    // THE INCIDENT'S SHAPE, replayed small: a short-lived helper that is
    // NOT the child's supervisor sends TERM — the kill the 2026-08-29
    // pkills would have become under this guard. Explicit pid, per the
    // interim law. The `sleep 1 & wait` keeps the helper's
    // /proc/<pid>/cmdline readable across the guard's drain, which is the
    // cmdline half of "named"; the pid and uid halves are recorded at
    // send time and survive even the fastest exit. (A plain trailing
    // `sleep 1` would make bash tail-exec it and the cmdline would read
    // "sleep 1".)
    const stranger = spawn("bash", ["-c", `echo $$; kill -TERM ${pid}; sleep 1 & wait`], {
      stdio: ["ignore", "pipe", "inherit"],
    })
    const strangerPid = Number(await firstLineOf(stranger))
    expect(strangerPid).toBeGreaterThan(0)
    expect(strangerPid).not.toBe(pid)

    await until(
      BOUND_MS,
      `the refusal of the stranger's TERM (said so far:\n${server.said()})`,
      () => server.said().includes(`refused SIGTERM from pid ${strangerPid} uid ${process.getuid?.()}`),
    )
    expect(server.said()).toContain("(bash -c")

    // KEEPING SERVING is the half a log line alone cannot prove: answer
    // a real HTTP request after the refused signal.
    const page = await fetch(url)
    expect(page.status).toBe(200)
    expect(process.kill(pid as number, 0)).toBe(true)

    // And the supervisor's path still stops it — this runner IS the
    // child's parent, which is also what the pre-existing SIGTERM test
    // above drives: the guard must not turn `systemctl stop` into a stop
    // nobody delivers.
    server.kill("SIGTERM")
    const code = await Promise.race([
      server.exited(),
      Bun.sleep(BOUND_MS).then(() => {
        throw new Error(`the supervisor's TERM did not stop the child within ${BOUND_MS}ms`)
      }),
    ])
    expect(code).toBe(130)
    expect(server.said()).toContain("honoring SIGTERM")
    expect(server.said()).toContain("olai web: received SIGTERM")
  } finally {
    server.kill()
  }
}, BOUND_MS * 4)

