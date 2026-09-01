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
 * `SUBREAPER` is an optional ancestor for the one leg that needs the kernel
 * arranged differently: it sets `PR_SET_CHILD_SUBREAPER` and then stays up,
 * so an orphaned descendant reparents to IT rather than to init. It prints
 * `prctl=` so the leg can refuse to pass on an arm that did not take — a
 * subreaper that failed to arm is the ordinary machine, where the leg would
 * pass for the wrong reason.
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
const [WRAPPER, KID, SUBREAPER] = ((): readonly [string, string, string] => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "olai-tie-"))
  const wrapper = path.join(dir, "wrapper.ts")
  const kid = path.join(dir, "kid.ts")
  const subreaper = path.join(dir, "subreaper.ts")
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
// the daemonising case. A TIE that is a NUMBER stamps that pid instead, which
// is the state the race leaves behind (tied to a process that is not my
// parent) staged without the race.
if (env.TIE === "yes") env[DIE_WITH_PARENT] = String(process.pid)
else if (env.TIE !== undefined) env[DIE_WITH_PARENT] = env.TIE
delete env.TIE
const child = spawn(process.execPath, process.argv.slice(2), {
  stdio: ["ignore", logFd, logFd],
  detached: true,
  env,
})
child.unref()
process.stdout.write("wrapper=" + process.pid + " child=" + child.pid + "\\n")
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
  fs.writeFileSync(
    subreaper,
    `import { dlopen, FFIType } from "bun:ffi"
import { spawn } from "node:child_process"

// PR_SET_CHILD_SUBREAPER = 36. Orphaned DESCENDANTS reparent here rather than
// to init — a session manager, a supervisor, \`systemd-run --user --scope\`.
const lib = dlopen("libc.so.6", {
  prctl: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
  waitpid: { args: [FFIType.i32, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
})
process.stdout.write("subreaper=" + process.pid + " prctl=" + lib.symbols.prctl(36, 1) + "\\n")
spawn(process.execPath, process.argv.slice(2), { stdio: "inherit", env: process.env })
// Stays up, because a reaper that exits is not one — and REAPS, because a
// subreaper that adopts without reaping leaves the adopted corpse in the
// table as a zombie, and a zombie answers signal 0 exactly like a live
// process. \`waitpid(-1, &status, WNOHANG)\` until it says nobody is waiting;
// the runtime only reaps the children it started itself.
const status = new Int32Array(1)
setInterval(() => {
  while (lib.symbols.waitpid(-1, status, 1) > 0);
}, 20)
`,
  )
  return [wrapper, kid, subreaper] as const
})()

interface Run {
  readonly wrapperPid: number
  readonly childPid: number
  /** The `PR_SET_CHILD_SUBREAPER` ancestor, when the leg asked for one. */
  readonly reaperPid: number | undefined
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
  /** `true` ties the child to the wrapper; a NUMBER ties it to that pid
   *  instead; `false` leaves it untied. */
  readonly tied: boolean | number
  readonly after: "exit" | "stay"
  readonly env?: NodeJS.ProcessEnv
  /** Put a `PR_SET_CHILD_SUBREAPER` ancestor in front of the wrapper. */
  readonly under?: "subreaper"
}): Promise<Run> => {
  const logPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "olai-tie-run-")), "child.log")
  const top = spawn(
    process.execPath,
    options.under === "subreaper"
      ? [SUBREAPER, WRAPPER, ...options.argv]
      : [WRAPPER, ...options.argv],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...options.env,
        CHILD_LOG: logPath,
        WRAPPER_EXITS: options.after === "exit" ? "yes" : "no",
        ...(options.tied === false
          ? {}
          : { TIE: options.tied === true ? "yes" : String(options.tied) }),
      },
    },
  )
  const said = saidBy(top)
  const log = (): string => (fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "")
  await until(
    BOUND_MS,
    () => `the wrapper to name itself and its child (it said: ${said()})`,
    () => /wrapper=\d+ child=\d+/.test(said()),
  )
  // Off the wrapper's OWN line rather than off this spawn, so both are right
  // whichever process this one actually started.
  const wrapperPid = Number(/wrapper=(\d+)/.exec(said())?.[1])
  const childPid = Number(/child=(\d+)/.exec(said())?.[1])
  expect(wrapperPid).toBeGreaterThan(0)
  expect(childPid).toBeGreaterThan(0)
  let reaperPid: number | undefined
  if (options.under === "subreaper") {
    const armed = /subreaper=(\d+) prctl=(-?\d+)/.exec(said())
    // A subreaper that did not arm is an ordinary process, and the leg that
    // asked for one would then pass for the wrong reason.
    expect(armed?.[2]).toBe("0")
    reaperPid = Number(armed?.[1])
    expect(reaperPid).toBe(top.pid as number)
  }
  return {
    wrapperPid,
    childPid,
    reaperPid,
    log,
    said,
    stop: () => {
      reap(childPid)
      reap(wrapperPid)
      reap(top.pid as number)
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
  // A REMINDER, NOT A PIN — and the difference is worth writing down,
  // because the two reviews of #455 disagreed about this line and the second
  // one is right. Two spawners sit behind a dependency wall that forbids
  // importing this constant and spell the name as a literal
  // (`packages/tests/support/hooks.ts`, `support/serve.sh`), so a rename
  // would leave every harness server untied with nothing going red — #355's
  // leak back, and the evidence `/tmp` filling up a week later. What
  // actually catches the rename is the COMPILE BREAK in
  // `./child.testlib.ts`, which imports the constant. This assertion cannot:
  // it lives in the same file as the constant, so one edit satisfies both in
  // the same breath. What it is good for is the checklist it carries — the
  // person making that edit is standing in front of the two file names above
  // at the moment they need them.
  expect(DIE_WITH_PARENT).toBe("OLAI_DIE_WITH_PARENT")
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
    // Read as a NUMBER — `ppid=1` is a prefix of `ppid=1234`, so a substring
    // assertion here would pass on the wrong pid.
    const orphanedAt = Number(/orphaned ppid=(\d+)/.exec(run.log())?.[1])
    expect(orphanedAt).toBeGreaterThan(0)
    expect(orphanedAt).not.toBe(run.wrapperPid)
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

test("PIN: the same race under a PR_SET_CHILD_SUBREAPER ancestor, where PID 1 never comes", async () => {
  // THE CLAIM THAT CHOSE THE DESIGN, and until now the only one the suite
  // took on trust. Gating #355's `getppid() === 1` on the spawn shape — the
  // smaller fix — passes six of the eight legs here, because an orphan on
  // this machine lands on init and the two rules agree. Under a subreaper
  // they do not: an orphaned descendant reparents to the nearest living
  // subreaper ancestor, so `getppid()` never reads 1 and the smaller fix
  // would sit through the very race it was written for. A session manager, a
  // supervisor and `systemd-run --user --scope` are all that ancestor, so
  // this is not an exotic machine — it is a user session.
  //
  // This leg and the tie-not-parent leg below are the two that catch it, and
  // they reach the same disagreement from opposite sides: this one arranges a
  // kernel where `getppid()` never reads 1, that one stages the state the
  // race leaves behind, in the product, where the old rule has nothing to
  // see.
  //
  // The arrangement: a grandparent that arms PR_SET_CHILD_SUBREAPER and stays
  // up, a wrapper that ties the kid to itself and exits, and a kid that waits
  // to be orphaned before it honors the tie. The assertion is BOTH halves, in
  // that order — the orphan landed on the subreaper and not on 1 (so the old
  // rule could not have fired), and the kid stopped anyway (so the tie did).
  if (process.platform !== "linux") return
  const run = await launch({
    argv: kidArgv("after-orphan"),
    tied: true,
    after: "exit",
    under: "subreaper",
  })
  try {
    await until(BOUND_MS, "the wrapper to exit", () => gone(run.wrapperPid))
    // THE ARRANGEMENT FIRST, and this order is the finding rather than a
    // style: waiting for the death first makes the lesser fix's red a
    // ten-second "SIGTERM never appeared", which is the same shape a kid that
    // hung before it reached the guard would produce — and the two lines that
    // say PID 1 never came would never have run. Asserted here, the same red
    // reads "the old rule could not have fired, and the kid did not stop".
    await until(
      BOUND_MS,
      () => `the kid to be reparented (log:\n${run.log()})`,
      () => /orphaned ppid=\d+/.test(run.log()),
    )
    const orphanedAt = Number(/orphaned ppid=(\d+)/.exec(run.log())?.[1])
    // `Number` rather than a cast: an absent reaper pid becomes NaN and fails
    // here, which is the right answer for a leg that asked for a subreaper.
    expect(orphanedAt).toBe(Number(run.reaperPid))
    expect(orphanedAt).not.toBe(1)
    // ...and only THEN the death, which is the half the tie is responsible for.
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

test("PIN: a TIED olai web whose tie is not its parent stops, and never serves", async () => {
  // THE CHECKED MOMENT IN THE PRODUCT. Every leg above ends in a kid that
  // exits from its own SIGTERM handler, so they show the signal was
  // DELIVERED and nothing about what this binary does with one: `main.ts`
  // has a SIGTERM listener registered before the guard runs that only writes
  // a line, and `@olai/sigterm`'s SELF arm — the one that exists to honor
  // this very kill — is installed later, inside the `web` handler. So the
  // self-TERM lands in a disposition no test here owned.
  //
  // Staged WITHOUT the race so that only the check can be what stops it: the
  // wrapper stays alive (its child's PDEATHSIG is armed against a process
  // that does not die, so the kernel sends nothing for the length of this
  // test) and ties the server to pid 1 instead of to itself — which is the
  // state the race leaves behind, a tie to a process that is not my parent.
  // The last assertion is the one that makes it airtight: the wrapper is
  // still alive when the server is gone.
  if (process.platform !== "linux") return
  const run = await launch({ ...webLeg(), tied: 1, after: "stay" })
  try {
    await until(
      BOUND_MS,
      () => `the server to stop itself (log:\n${run.log()})`,
      () => gone(run.childPid),
    )
    // Through the real disposition — `main.ts`'s own listener says so — and
    // before it ever bound.
    expect(run.log()).toContain("olai web: received SIGTERM")
    expect(run.log()).not.toContain("message=serving")
    expect(alive(run.wrapperPid)).toBe(true)
  } finally {
    run.stop()
  }
}, BOUND_MS * 4)

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
