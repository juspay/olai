/**
 * WHO a server dies with — and who it does not.
 *
 * #355 armed `PR_SET_PDEATHSIG` in every server it started and paired it with
 * `getppid() === 1` for the race that arm cannot cover. The second half read
 * every daemonised process as an orphan, so a server whose wrapper exited on
 * purpose killed itself while healthy (2026-08-23, mid-recording). A server is
 * TIED to its spawner now — by pid, and only when that spawner asked — and
 * this file is the pair of outcomes the tie exists to keep apart:
 *
 *   - TIED, and the parent dies     → the server stops (#355's floor, kept)
 *   - UNTIED, and the wrapper exits → the server keeps serving (the fix)
 *
 * ONE wrapper drives all five process legs, and it takes exactly two switches:
 * whether it TIES the child to itself, and whether it EXITS or waits to be
 * killed. So the difference between any two legs below is one of those two
 * switches and nothing else — which is the design stated as a test rather than
 * as a comment. The death half moved here from `shutdown.test.ts`, which is
 * about what a SIGNAL does to this process; this is about who is allowed to
 * make the kernel send one.
 *
 * These are child processes because that is the only place the property
 * exists. A parent's death is not observable in the runner that would have to
 * die to produce it, and `dieWithParent()` run IN this process would tie the
 * test runner to a pid that is not its parent, read that back, and SIGTERM the
 * runner. Nothing here calls it in process, and nothing here should.
 */

import { expect, test } from "bun:test"
import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { DIE_WITH_PARENT, parentTie } from "./dieWithParent.ts"
import { served } from "./serve.testlib.ts"

/** Hang detector only: what is being told apart is "under a second" from
 *  "never". */
const BOUND_MS = 10_000

/** How long a process that should NOT have died is watched before it counts as
 *  having survived. Long enough to cover the self-TERM, which #355's check
 *  delivers in the same tick as the arm — a survivor that was going to die is
 *  dead many times over by here. */
const SURVIVE_MS = 1_500

/** Poll until `predicate` holds or `ms` runs out — the failure names what never
 *  happened rather than what the runner clocked. `what` may be a thunk, and is
 *  read at the THROW: a message interpolated at the call would quote the empty
 *  box the wait was about to fill. */
const until = async (
  ms: number,
  what: string | (() => string),
  predicate: () => boolean,
): Promise<void> => {
  const deadline = Date.now() + ms
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`${typeof what === "function" ? what() : what} never happened within ${ms}ms`)
    }
    await Bun.sleep(20)
  }
}

/** In the process table, as the kernel answers it. Signal 0 is the question. */
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const gone = (pid: number): boolean => !alive(pid)

/** EXPLICIT PID, and always this file's own: every leg leaves a process no
 *  wrapper is left to collect. ESRCH is the ordinary case — the leg under test
 *  is often the thing that killed it. */
const reap = (pid: number): void => {
  try {
    process.kill(pid, "SIGKILL")
  } catch {
    // already gone
  }
}

/** Everything a helper said, both channels, from spawn — the box a later
 *  assertion reads is the one the wait filled. */
const saidBy = (proc: ReturnType<typeof spawn>): (() => string) => {
  let box = ""
  proc.stdout?.setEncoding("utf8")
  proc.stderr?.setEncoding("utf8")
  proc.stdout?.on("data", (chunk: string) => {
    box += chunk
  })
  proc.stderr?.on("data", (chunk: string) => {
    box += chunk
  })
  return () => box
}

/**
 * The two helper scripts, written once for the file.
 *
 * `WRAPPER` spawns whatever argv it is handed, names the child's pid on its
 * stdout, and then either exits (a daemonising wrapper) or waits to be killed
 * (a runner). It hands the child a LOG FILE rather than a pipe, because its
 * pipes die with it and a write into a dead pipe is an EPIPE that would kill
 * the child for a reason nothing here is about (the hazard `shutdown.test.ts`
 * hit while its first premise was wrong, fake-green). The child's file
 * descriptor is its own, so the wrapper's death does not close it.
 *
 * `KID` is the mechanism on its own — no server, no ports, nothing to boot —
 * so the three mechanism legs are about the guard and not about a server that
 * also has a guard. Its `mode` is WHEN it honors the tie: `now` is the
 * ordinary spawn, `after-orphan` waits until its parent is gone first, which
 * is #355's race made deterministic rather than left to whether the wrapper's
 * exit won. It is TOLD who spawned it (`SPAWNER`, stamped by the wrapper)
 * rather than reading `process.ppid` at start, because by the time a kid under
 * a wrapper that exits has booted, that read is already 1.
 */
const [WRAPPER, KID] = ((): readonly [string, string] => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "olai-tie-"))
  const wrapper = path.join(dir, "wrapper.ts")
  const kid = path.join(dir, "kid.ts")
  const guard = JSON.stringify(path.join(import.meta.dirname, "dieWithParent.ts"))
  fs.writeFileSync(
    wrapper,
    `import { spawn } from "node:child_process"
import * as fs from "node:fs"
import { DIE_WITH_PARENT } from ${guard}

const logFd = fs.openSync(process.env.CHILD_LOG, "w")
const env = { ...process.env, SPAWNER: String(process.pid) }
// The tie is the WRAPPER's own pid: one asserted by anyone but the direct
// parent names a process that is not one. Unstamped, the child is untied —
// the daemonising case.
if (env.TIE === "yes") env[DIE_WITH_PARENT] = String(process.pid)
delete env.TIE
const child = spawn(process.execPath, process.argv.slice(2), {
  stdio: ["ignore", logFd, logFd],
  detached: true,
  env,
})
child.unref()
process.stdout.write("child=" + child.pid + "\\n")
if (process.env.WRAPPER_EXITS === "yes") process.exit(0)
setInterval(() => {}, 1 << 30)
`,
  )
  fs.writeFileSync(
    kid,
    `import * as fs from "node:fs"
import { DIE_WITH_PARENT, dieWithParent } from ${guard}

const mode = process.argv[2]
const spawner = Number(process.env.SPAWNER)
// fd 1 directly: the wrapper pointed it at a file, and an unflushed buffer
// would read from out here exactly like a process that never got there.
const say = (line) => fs.writeSync(1, line + "\\n")
process.on("SIGTERM", () => {
  say("SIGTERM")
  process.exit(0)
})
say("start ppid=" + process.ppid + " tied-to=" + (process.env[DIE_WITH_PARENT] ?? "<nobody>"))

const honor = () => {
  dieWithParent()
  say("honored ppid=" + process.ppid + " still-tied-to=" + (process.env[DIE_WITH_PARENT] ?? "<nobody>"))
  let beat = 0
  const beating = setInterval(() => {
    say("beat=" + ++beat + " ppid=" + process.ppid)
    if (beat >= 60) clearInterval(beating)
  }, 100)
}

if (mode === "now") honor()
else {
  const watching = setInterval(() => {
    if (process.ppid === spawner) return
    clearInterval(watching)
    say("orphaned ppid=" + process.ppid)
    honor()
  }, 20)
}
`,
  )
  return [wrapper, kid] as const
})()

interface Run {
  readonly wrapperPid: number
  readonly childPid: number
  /** Everything the child wrote to either channel, from a file the wrapper's
   *  death cannot take with it. */
  readonly log: () => string
  /** What the WRAPPER said — the `child=` line, and anything it died of. */
  readonly said: () => string
  readonly stop: () => void
}

/**
 * Run one leg: a wrapper on `argv`, with the two switches.
 *
 * The wait is the `child=` line, so a caller is handed a pid rather than a
 * regex and a mutable slot to park it in.
 */
const launch = async (options: {
  readonly argv: ReadonlyArray<string>
  readonly tied: boolean
  readonly after: "exit" | "stay"
  readonly env?: NodeJS.ProcessEnv
}): Promise<Run> => {
  const logPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "olai-tie-run-")), "child.log")
  const wrapper = spawn(process.execPath, [WRAPPER, ...options.argv], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...options.env,
      CHILD_LOG: logPath,
      WRAPPER_EXITS: options.after === "exit" ? "yes" : "no",
      ...(options.tied ? { TIE: "yes" } : {}),
    },
  })
  const said = saidBy(wrapper)
  const log = (): string => (fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "")
  await until(
    BOUND_MS,
    () => `the wrapper to name its child (it said: ${said()})`,
    () => /child=\d+/.test(said()),
  )
  const childPid = Number(/child=(\d+)/.exec(said())?.[1])
  expect(childPid).toBeGreaterThan(0)
  const wrapperPid = wrapper.pid as number
  expect(wrapperPid).toBeGreaterThan(0)
  return {
    wrapperPid,
    childPid,
    log,
    said,
    stop: () => {
      reap(childPid)
      reap(wrapperPid)
    },
  }
}

/** The mechanism leg's argv. */
const kidArgv = (mode: "now" | "after-orphan"): ReadonlyArray<string> => [KID, mode]

/** The real server's argv, and the environment a boot of it needs: a stand-in
 *  bundle, no agent, logfmt so the serving line is readable, and a runtime
 *  directory of its own so the one-brain lock lands beside this test. */
const webLeg = (): { readonly argv: ReadonlyArray<string>; readonly env: NodeJS.ProcessEnv } => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "olai-tie-dist-"))
  fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html>\n")
  return {
    argv: [path.join(import.meta.dirname, "main.ts"), "web", served(), "--no-commit"],
    env: {
      OLAI_DIST_DIR: dist,
      OLAI_ACP_AGENT: "",
      OLAI_LOG: "logfmt",
      XDG_RUNTIME_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "olai-tie-runtime-")),
    },
  }
}

test("the tie is a pid or it is nothing, and nothing is read into silence", () => {
  expect(parentTie({})).toEqual({ parent: null })
  expect(parentTie({ [DIE_WITH_PARENT]: "" })).toEqual({ parent: null })
  expect(parentTie({ [DIE_WITH_PARENT]: "4321" })).toEqual({ parent: 4321 })
  // A tie to pid 1 is legitimate, which is why the tie is a pid and never a
  // yes whose "1" would collide with it. (The case for it — a container's
  // entry point is PID 1 and may spawn a server it means to keep — is
  // REASONED and not measured; no container was stood up for it.)
  expect(parentTie({ [DIE_WITH_PARENT]: "1" })).toEqual({ parent: 1 })
  // Anything that is not a pid is a caller mistake, and the answer to a
  // mistake is to NOT die: a complaint, and no tie.
  for (const raw of ["yes", "true", "0", "-1", " 12", "12x", "1e3", "99999999999999999999"]) {
    const tie = parentTie({ [DIE_WITH_PARENT]: raw })
    expect(tie.parent).toBeNull()
    expect(tie.parent === null && tie.complaint).toContain(DIE_WITH_PARENT)
  }
})

test("PIN: an UNTIED process survives its spawner exiting", async () => {
  // THE REGRESSION, at the mechanism. #355's check is `getppid() === 1`, so
  // this process — reparented to init by a wrapper that exited on purpose —
  // used to send itself SIGTERM the moment it armed. It is the daemonising
  // shape: `olai web &` from a script that returns, a recorder that starts a
  // server and gets out of the way, anything double-forked.
  if (process.platform !== "linux") return
  const run = await launch({ argv: kidArgv("after-orphan"), tied: false, after: "exit" })
  try {
    await until(BOUND_MS, "the wrapper to exit", () => gone(run.wrapperPid))
    await until(
      BOUND_MS,
      () => `the kid to reach the guard after being orphaned (log:\n${run.log()})`,
      () => run.log().includes("honored"),
    )
    // Reparented, and it knows: the very condition the old check called death.
    expect(run.log()).toMatch(/orphaned ppid=\d+/)
    expect(run.log()).not.toContain(`orphaned ppid=${run.wrapperPid}`)
    await Bun.sleep(SURVIVE_MS)
    expect(run.log()).not.toContain("SIGTERM")
    expect(alive(run.childPid)).toBe(true)
    // Alive is not enough — a stopped process is also in the table. It is
    // still RUNNING, which is what the beats say.
    expect((run.log().match(/beat=\d+/g) ?? []).length).toBeGreaterThan(5)
  } finally {
    run.stop()
  }
}, BOUND_MS * 3)

test("PIN: a TIED process dies with the spawner it was tied to", async () => {
  // #355's floor, unchanged: the kernel's parent-death signal, armed because
  // the spawner tied this process to itself. This is the e2e harness's case —
  // cucumber SIGKILLed by odu's timeout — and it is the leg above with the
  // other setting of both switches.
  if (process.platform !== "linux") return
  const run = await launch({ argv: kidArgv("now"), tied: true, after: "stay" })
  try {
    await until(
      BOUND_MS,
      () => `the kid to honor its tie (log:\n${run.log()})`,
      () => run.log().includes("honored"),
    )
    expect(run.log()).toContain(`tied-to=${run.wrapperPid}`)
    process.kill(run.wrapperPid, "SIGKILL")
    await until(
      BOUND_MS,
      () => `the kid to be signalled (log:\n${run.log()})`,
      () => run.log().includes("SIGTERM"),
    )
    await until(BOUND_MS, "the kid to exit", () => gone(run.childPid))
  } finally {
    run.stop()
  }
}, BOUND_MS * 3)

test("PIN: the race — tied to a spawner that is already gone, and it stops anyway", async () => {
  // The half `PR_SET_PDEATHSIG` cannot cover: a parent that died before the
  // arm is a signal that was already not sent, and no later one is coming
  // (measured — arming after the parent's death delivers nothing, ever). The
  // check is the tie read back — "the process I was tied to is not my parent
  // any more" — the same sentence whether the orphan landed on init or on a
  // `PR_SET_CHILD_SUBREAPER` ancestor. `getppid() === 1` is only true in the
  // first of those.
  //
  // Same timing as the survival leg above; the tie is the whole difference.
  if (process.platform !== "linux") return
  const run = await launch({ argv: kidArgv("after-orphan"), tied: true, after: "exit" })
  try {
    await until(BOUND_MS, "the wrapper to exit", () => gone(run.wrapperPid))
    await until(
      BOUND_MS,
      () => `the kid to stop itself (log:\n${run.log()})`,
      () => run.log().includes("SIGTERM"),
    )
    expect(run.log()).toContain(`tied-to=${run.wrapperPid}`)
    await until(BOUND_MS, "the kid to exit", () => gone(run.childPid))
  } finally {
    run.stop()
  }
}, BOUND_MS * 3)

test("PIN: a wrapper-started olai web outlives the wrapper, and goes on serving", async () => {
  // THE LANE'S BAR, at the product: a daemonising wrapper's whole job is to
  // exit and leave the server running. It lost a demo recording on
  // 2026-08-23, and the workaround was the awkward one — keep the server a
  // child of the recorder. This is that shape with nothing kept: the wrapper
  // is gone, no tie was stamped, and the server answers an HTTP request
  // afterwards.
  if (process.platform !== "linux") return
  const run = await launch({ ...webLeg(), tied: false, after: "exit" })
  try {
    await until(
      BOUND_MS,
      () => `the server to bind (log:\n${run.log()})`,
      () => /message=serving/.test(run.log()),
    )
    const url = /url=(http:\/\/[^\s]+)/.exec(run.log())?.[1] ?? ""
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)

    await until(BOUND_MS, "the wrapper to exit", () => gone(run.wrapperPid))
    // Orphaned — the state the old check called death — and left alone.
    await Bun.sleep(SURVIVE_MS)
    expect(alive(run.childPid)).toBe(true)
    expect(run.log()).not.toContain("received SIGTERM")
    // Alive is not serving. The request is the property.
    const page = await fetch(url)
    expect(page.status).toBe(200)
  } finally {
    run.stop()
  }
}, BOUND_MS * 4)

test("olai web dies when its parent dies — BY THE GUARD'S HONOR, not by any side effect", async () => {
  // `prctl(PR_SET_PDEATHSIG)`: SIGKILL of cucumber used to reparent every
  // detached server to init. A wrapper process is the parent here, it tied the
  // server to itself (the one difference from the leg above), and killing it
  // must take the server with it. Under the guard that death is a policy
  // decision: the kernel's signal arrives with the dying parent's pid
  // (measured: SI_USER from the parent itself, never si_pid 0), and this test
  // asserts the child's journal HONORS it — the line is the contract, the
  // corpse alone is not: a refusal line written into a pipe whose reader just
  // died would also kill the child (EPIPE), and did precisely that while the
  // first draft's premise was wrong, fake-green here. So the child logs to a
  // FILE the wrapper cannot take with it, and the assertion names both the
  // honoring and the death.
  if (process.platform !== "linux") return
  const run = await launch({ ...webLeg(), tied: true, after: "stay" })
  try {
    await until(
      BOUND_MS,
      () => `the child's guard to arm (log:\n${run.log()})`,
      () => run.log().includes("SIGTERM guard armed"),
    )
    process.kill(run.wrapperPid, "SIGKILL")
    await until(
      BOUND_MS,
      () => `the kernel's parent-death signal to be honored (log:\n${run.log()})`,
      () => run.log().includes(`honoring SIGTERM from pid ${run.wrapperPid}`),
    )
    await until(BOUND_MS, "the child to exit", () => gone(run.childPid))
    // (the wrapper reaped before the drain read its cmdline is the ordinary
    // case — pid and uid, recorded at send time, must carry it)
    expect(run.log()).toContain(
      `honoring SIGTERM from pid ${run.wrapperPid} uid ${process.getuid?.()}`,
    )
    expect(run.log()).toContain("olai web: received SIGTERM")
  } finally {
    run.stop()
  }
}, BOUND_MS * 4)
