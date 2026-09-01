/**
 * WHO a server dies with — and who it does not.
 *
 * #355 tied a spawned server to its parent with `PR_SET_PDEATHSIG` and paired
 * it with `getppid() === 1` for the race that arm cannot cover. The second
 * half read every daemonised process as an orphan, so a server whose wrapper
 * exited on purpose killed itself while healthy (2026-08-23, mid-recording).
 * The gate is the spawn shape now, and this file is the pair of outcomes that
 * gate exists to keep apart:
 *
 *   - told, and the parent dies      → the server stops (#355's floor, kept)
 *   - not told, and the parent exits → the server keeps serving (the fix)
 *
 * Both are here, in one file, on the same wrapper: the ONLY difference
 * between the two real-server legs at the bottom is whether the wrapper set
 * `OLAI_DIE_WITH_PARENT`, and a reader can see that by looking at them side
 * by side. The death half moved here from `shutdown.test.ts`, which is about
 * what a SIGNAL does to this process; this is about who is allowed to send
 * one on the kernel's behalf.
 *
 * These are child processes because that is the only place the property
 * exists. A parent's death is not observable in the runner that would have to
 * die to produce it, and `dieWithParent()` run IN this process would arm
 * the test runner's own parent-death signal and — finding the runner's parent
 * is not the pid it was handed — SIGTERM the runner. Nothing here calls it in
 * process, and nothing here should.
 */

import { expect, test } from "bun:test"
import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { DIE_WITH_PARENT, parentDeathPolicy } from "./dieWithParent.ts"
import { served } from "./serve.testlib.ts"

/** Hang detector only: what is being told apart is "under a second" from
 *  "never". */
const BOUND_MS = 10_000

/** How long a process that should NOT have died is watched before it counts
 *  as having survived. Long enough to cover the self-TERM, which #355's check
 *  delivers in the same tick as the arm — a survivor that was going to
 *  die is dead many times over by here. */
const SURVIVE_MS = 1_500

/** Poll until `predicate` holds or `ms` runs out — the failure names what
 *  never happened rather than what the runner clocked. */
const until = async (ms: number, what: string, predicate: () => boolean): Promise<void> => {
  const deadline = Date.now() + ms
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`${what} never happened within ${ms}ms`)
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
 * `kid.ts` is the mechanism on its own — no server, no ports, nothing to boot
 * — so the three mechanism legs below are about the guard and not about a
 * server that also has a guard. It logs to a FILE: its pipes belong to a
 * wrapper that is about to die, and a write into a dead pipe is an EPIPE that
 * would kill the child for the wrong reason (the hazard `shutdown.test.ts`
 * hit while its first premise was wrong, fake-green).
 *
 * `mode` is WHEN it arms: `now` is the ordinary spawn, `after-orphan` waits
 * until its parent is gone first, which is #355's race made deterministic
 * rather than left to whether the wrapper's exit won.
 */
const helpers = (() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "olai-diewith-"))
  const kid = path.join(dir, "kid.ts")
  const wrapper = path.join(dir, "wrapper.ts")
  const guard = JSON.stringify(path.join(import.meta.dirname, "dieWithParent.ts"))
  fs.writeFileSync(
    kid,
    `import * as fs from "node:fs"
import { DIE_WITH_PARENT, dieWithParent } from ${guard}

const [log, mode, spawner] = process.argv.slice(2)
const lines = []
const say = (line) => {
  lines.push(line)
  fs.writeFileSync(log, lines.join("\\n") + "\\n")
}
process.on("SIGTERM", () => {
  say("SIGTERM")
  process.exit(0)
})
say("start ppid=" + process.ppid + " told=" + (process.env[DIE_WITH_PARENT] ?? "<unset>"))

const arm = () => {
  dieWithParent()
  say("armed ppid=" + process.ppid + " still-told=" + (process.env[DIE_WITH_PARENT] ?? "<unset>"))
  let beat = 0
  const beating = setInterval(() => {
    say("beat=" + ++beat + " ppid=" + process.ppid)
    if (beat >= 60) clearInterval(beating)
  }, 100)
}

if (mode === "now") arm()
else {
  const watching = setInterval(() => {
    if (process.ppid === Number(spawner)) return
    clearInterval(watching)
    say("orphaned ppid=" + process.ppid)
    arm()
  }, 20)
}
`,
  )
  fs.writeFileSync(
    wrapper,
    `import { spawn } from "node:child_process"
import { DIE_WITH_PARENT } from ${guard}

const [kid, log, mode, after] = process.argv.slice(2)
const env = { ...process.env }
// The ASKER's own pid, which is the spawned process's real parent — set here
// rather than by the test, because a claim made by anyone but the direct
// parent is a claim about a process that is not one.
if (env.WITH_MARKER === "yes") env[DIE_WITH_PARENT] = String(process.pid)
delete env.WITH_MARKER
const child = spawn(process.execPath, [kid, log, mode, String(process.pid)], {
  detached: true,
  stdio: "ignore",
  env,
})
child.unref()
process.stdout.write("kid=" + child.pid + "\\n")
// A DAEMONISING wrapper exits and leaves the child running; a runner stays up
// to be killed. One script, because the difference between the two cases has
// to be this and nothing else.
if (after === "exit") process.exit(0)
setInterval(() => {}, 1 << 30)
`,
  )
  return { kid, wrapper, dir }
})()

/** Start a wrapper, and come back with its pid, the kid's, and the kid's log. */
const launch = async (options: {
  readonly mode: "now" | "after-orphan"
  readonly marker: boolean
  readonly after: "exit" | "stay"
}): Promise<{
  readonly wrapperPid: number
  readonly kidPid: number
  readonly log: () => string
  readonly said: () => string
}> => {
  const logPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "olai-diewith-run-")), "kid.log")
  const wrapper = spawn(
    process.execPath,
    [helpers.wrapper, helpers.kid, logPath, options.mode, options.after],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...(options.marker ? { WITH_MARKER: "yes" } : {}) },
    },
  )
  const said = saidBy(wrapper)
  await until(BOUND_MS, `the wrapper to name its child (said: ${said()})`, () => /kid=\d+/.test(said()))
  const kidPid = Number(/kid=(\d+)/.exec(said())?.[1])
  expect(kidPid).toBeGreaterThan(0)
  return {
    wrapperPid: wrapper.pid as number,
    kidPid,
    log: () => (fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : ""),
    said,
  }
}

test("the policy is what the spawner asked for, and nothing is read into silence", () => {
  expect(parentDeathPolicy({})).toEqual({ arm: false })
  expect(parentDeathPolicy({ [DIE_WITH_PARENT]: "" })).toEqual({ arm: false })
  expect(parentDeathPolicy({ [DIE_WITH_PARENT]: "4321" })).toEqual({ arm: true, parent: 4321 })
  // A pid of 1 is a legitimate spawner — a container's entry point is PID 1
  // and may spawn a server it means to keep — which is why the variable
  // carries a pid and never a yes whose "1" would collide with it.
  expect(parentDeathPolicy({ [DIE_WITH_PARENT]: "1" })).toEqual({ arm: true, parent: 1 })
  // Anything that is not a pid is a caller mistake, and the answer to a
  // mistake is to NOT die: a complaint, and no arm.
  for (const raw of ["yes", "true", "0", "-1", " 12", "12x", "1e3", "99999999999999999999"]) {
    const policy = parentDeathPolicy({ [DIE_WITH_PARENT]: raw })
    expect(policy.arm).toBe(false)
    expect(policy.arm === false && policy.complaint).toContain(DIE_WITH_PARENT)
  }
})

test("PIN: a process NOBODY tied to itself survives its spawner exiting", async () => {
  // THE REGRESSION, at the mechanism. Today's check is `getppid() === 1`, so
  // this process — reparented to init by a wrapper that exited on purpose —
  // used to send itself SIGTERM the moment it armed. It is the daemonising
  // shape: `olai web &` from a script that returns, a recorder that starts a
  // server and gets out of the way, anything double-forked.
  if (process.platform !== "linux") return
  const run = await launch({ mode: "after-orphan", marker: false, after: "exit" })
  try {
    await until(BOUND_MS, "the wrapper to exit", () => gone(run.wrapperPid))
    await until(BOUND_MS, `the kid to arm after being orphaned (log:\n${run.log()})`, () =>
      run.log().includes("armed"))
    // Reparented, and it knows: the very condition the old check called death.
    expect(run.log()).toMatch(/orphaned ppid=\d+/)
    expect(run.log()).not.toContain(`orphaned ppid=${run.wrapperPid}`)
    await Bun.sleep(SURVIVE_MS)
    expect(run.log()).not.toContain("SIGTERM")
    expect(alive(run.kidPid)).toBe(true)
    // Alive is not enough — a stopped process is also in the table. It is
    // still RUNNING, which is what the beats say.
    const beats = run.log().match(/beat=\d+/g) ?? []
    expect(beats.length).toBeGreaterThan(5)
  } finally {
    try {
      process.kill(run.kidPid, "SIGKILL")
    } catch {
      // already gone
    }
    try {
      process.kill(run.wrapperPid, "SIGKILL")
    } catch {
      // already gone
    }
  }
}, BOUND_MS * 3)

test("PIN: a process that WAS tied to its spawner dies with it", async () => {
  // #355's floor, unchanged: the kernel's parent-death signal, armed because
  // the spawner asked. This is the e2e harness's case — cucumber SIGKILLed by
  // odu's timeout — and it is the same wrapper as the leg above with one
  // variable set.
  if (process.platform !== "linux") return
  const run = await launch({ mode: "now", marker: true, after: "stay" })
  try {
    await until(BOUND_MS, `the kid to arm (log:\n${run.log()})`, () => run.log().includes("armed"))
    expect(run.log()).toContain(`told=${run.wrapperPid}`)
    process.kill(run.wrapperPid, "SIGKILL")
    await until(BOUND_MS, `the kid to be signalled (log:\n${run.log()})`, () =>
      run.log().includes("SIGTERM"))
    await until(BOUND_MS, "the kid to exit", () => gone(run.kidPid))
  } finally {
    try {
      process.kill(run.kidPid, "SIGKILL")
    } catch {
      // already gone
    }
    try {
      process.kill(run.wrapperPid, "SIGKILL")
    } catch {
      // already gone
    }
  }
}, BOUND_MS * 3)

test("PIN: the race — tied to a spawner that is already gone, and it stops anyway", async () => {
  // The half `PR_SET_PDEATHSIG` cannot cover: a parent that died before the
  // arm is a signal that was already not sent, and no later one is coming
  // (measured — arming after the parent's death delivers nothing, ever). The
  // check is "the process that tied me to it is not my parent any more",
  // which is the same sentence whether the orphan landed on init or on a
  // `PR_SET_CHILD_SUBREAPER` ancestor. `getppid() === 1` is only true in the
  // first of those.
  //
  // Same timing as the survival leg above; the marker is the whole difference.
  if (process.platform !== "linux") return
  const run = await launch({ mode: "after-orphan", marker: true, after: "exit" })
  try {
    await until(BOUND_MS, "the wrapper to exit", () => gone(run.wrapperPid))
    await until(BOUND_MS, `the kid to stop itself (log:\n${run.log()})`, () =>
      run.log().includes("SIGTERM"))
    expect(run.log()).toContain(`told=${run.wrapperPid}`)
    await until(BOUND_MS, "the kid to exit", () => gone(run.kidPid))
  } finally {
    try {
      process.kill(run.kidPid, "SIGKILL")
    } catch {
      // already gone
    }
  }
}, BOUND_MS * 3)

/**
 * The real thing, twice: `olai web` under a wrapper that exits, and under a
 * wrapper that is killed.
 *
 * A wrapper that writes the child's pid, hands it a LOG FILE (its own pipes
 * die with it, and a write into a dead pipe is an EPIPE that would kill the
 * server for a reason nothing here is about), and then either exits or waits
 * to be killed.
 */
const webWrapper = (() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "olai-web-wrapper-"))
  const file = path.join(dir, "wrapper.ts")
  fs.writeFileSync(
    file,
    `import { spawn } from "node:child_process"
import * as fs from "node:fs"
import { DIE_WITH_PARENT } from ${JSON.stringify(path.join(import.meta.dirname, "dieWithParent.ts"))}

const logFd = fs.openSync(process.env.CHILD_LOG, "w")
const env = { ...process.env }
// The wrapper's OWN pid: a claim made by anyone but the direct parent is a
// claim about a process that is not one. Absent, and the server is tied to
// nobody — the daemonising case.
if (env.WITH_MARKER === "yes") env[DIE_WITH_PARENT] = String(process.pid)
delete env.WITH_MARKER
const child = spawn(process.execPath, process.argv.slice(2), {
  stdio: ["ignore", logFd, logFd],
  detached: true,
  env,
})
child.unref()
process.stdout.write("child=" + child.pid + "\\n")
// Exit and leave it running (a daemonising wrapper), or stay up to be killed
// (a runner). The difference between the two legs below is this and the
// marker, and nothing else.
if (process.env.WRAPPER_EXITS === "yes") process.exit(0)
setInterval(() => {}, 1 << 30)
`,
  )
  return file
})()

/** A dist, a runtime dir and a log, per server. */
const webRun = (marker: "tied" | "untied", wrapperExits: boolean): {
  readonly wrapper: ReturnType<typeof spawn>
  readonly said: () => string
  readonly log: () => string
} => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "olai-web-parent-"))
  const childLog = path.join(tmp, "child.log")
  const dist = path.join(tmp, "dist")
  fs.mkdirSync(dist)
  fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html>\n")
  const wrapper = spawn(
    process.execPath,
    [webWrapper, path.join(import.meta.dirname, "main.ts"), "web", served(), "--no-commit"],
    {
      env: {
        ...process.env,
        CHILD_LOG: childLog,
        WRAPPER_EXITS: wrapperExits ? "yes" : "no",
        OLAI_DIST_DIR: dist,
        OLAI_ACP_AGENT: "",
        OLAI_LOG: "logfmt",
        XDG_RUNTIME_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "olai-web-parent-run-")),
        // The wrapper sets the marker to its OWN pid, so this is a request to
        // pass one on rather than the marker itself: a value computed here
        // would name the TEST RUNNER, which is the server's grandparent and
        // not its parent.
        ...(marker === "tied" ? { WITH_MARKER: "yes" } : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  return {
    wrapper,
    said: saidBy(wrapper),
    log: () => (fs.existsSync(childLog) ? fs.readFileSync(childLog, "utf8") : ""),
  }
}

test("PIN: a wrapper-started olai web outlives the wrapper, and goes on serving", async () => {
  // THE LANE'S BAR, at the product: a daemonising wrapper's whole job is to
  // exit and leave the server running. It lost a demo recording on
  // 2026-08-23, and the workaround was the awkward one — keep the server a
  // child of the recorder. This is that shape with nothing kept: the wrapper
  // is gone, and the server answers an HTTP request afterwards.
  if (process.platform !== "linux") return
  const run = webRun("untied", true)
  let childPid = 0
  try {
    await until(BOUND_MS, `the wrapper to name its child (said: ${run.said()})`, () =>
      /child=\d+/.test(run.said()))
    childPid = Number(/child=(\d+)/.exec(run.said())?.[1])
    expect(childPid).toBeGreaterThan(0)
    const wrapperPid = run.wrapper.pid as number
    await until(BOUND_MS, `the server to bind (log:\n${run.log()})`, () =>
      /message=serving/.test(run.log()))
    const url = /url=(http:\/\/[^\s]+)/.exec(run.log())?.[1] ?? ""
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)

    await until(BOUND_MS, "the wrapper to exit", () => gone(wrapperPid))
    // Orphaned — the state the old check called death — and left alone.
    await Bun.sleep(SURVIVE_MS)
    expect(alive(childPid)).toBe(true)
    expect(run.log()).not.toContain("received SIGTERM")
    // Alive is not serving. The request is the property.
    const page = await fetch(url)
    expect(page.status).toBe(200)
  } finally {
    // EXPLICIT PID, and this test's own: the wrapper is gone, so nothing else
    // will collect this one.
    if (childPid > 0) {
      try {
        process.kill(childPid, "SIGKILL")
      } catch {
        // already gone
      }
    }
    run.wrapper.kill("SIGKILL")
  }
}, BOUND_MS * 4)

test("olai web dies when its parent dies — BY THE GUARD'S HONOR, not by any side effect", async () => {
  // `prctl(PR_SET_PDEATHSIG)`: SIGKILL of cucumber used to reparent every
  // detached server to init. A wrapper process is the parent here, it asked
  // to be died with (the one difference from the leg above), and killing it
  // must take the server with it. Under the guard that death is a POLICY
  // decision: the kernel's signal arrives with the dying parent's pid
  // (measured: SI_USER from the parent itself, never si_pid 0), and this test
  // asserts the child's journal HONORS it — the line is the contract, the
  // corpse alone is not: a refusal line written into a pipe whose reader just
  // died would also kill the child (EPIPE), and did precisely that while the
  // first draft's premise was wrong, fake-green here. So the child logs to a
  // FILE the wrapper cannot take with it, and the assertion names both the
  // honoring and the death.
  if (process.platform !== "linux") return
  const run = webRun("tied", false)
  let childPid = 0
  try {
    await until(BOUND_MS, `the wrapper to name its child (said: ${run.said()})`, () =>
      /child=\d+/.test(run.said()))
    childPid = Number(/child=(\d+)/.exec(run.said())?.[1])
    expect(childPid).toBeGreaterThan(0)
    const wrapperPid = run.wrapper.pid as number
    expect(wrapperPid).toBeGreaterThan(0)

    await until(BOUND_MS, "the child's guard to arm", () => run.log().includes("SIGTERM guard armed"))

    run.wrapper.kill("SIGKILL")
    await until(
      BOUND_MS,
      "the kernel's parent-death signal to be honored",
      () => run.log().includes(`honoring SIGTERM from pid ${wrapperPid}`),
    )
    await until(BOUND_MS, "the child to exit", () => gone(childPid))
    const journal = run.log()
    // (the wrapper reaped before the drain read its cmdline is the
    // ordinary case — pid and uid, recorded at send time, must carry it)
    expect(journal).toContain(`honoring SIGTERM from pid ${wrapperPid} uid ${process.getuid?.()}`)
    expect(journal).toContain("olai web: received SIGTERM")
  } finally {
    if (childPid > 0) {
      try {
        process.kill(childPid, "SIGKILL")
      } catch {
        // already gone
      }
    }
    run.wrapper.kill("SIGKILL")
  }
}, BOUND_MS * 4)
