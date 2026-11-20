import { expect, test } from "bun:test"
import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { DIE_WITH_PARENT, parentTie } from "./dieWithParent.ts"
import { served } from "./serve.testlib.ts"

const BOUND_MS = 10_000

const SURVIVE_MS = 1_500

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

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const gone = (pid: number): boolean => !alive(pid)

const reap = (pid: number): void => {
  try {
    process.kill(pid, "SIGKILL")
  } catch {
  }
}

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
  readonly reaperPid: number | undefined
  readonly log: () => string
  readonly said: () => string
  readonly stop: () => void
}

const launch = async (options: {
  readonly argv: ReadonlyArray<string>
  readonly tied: boolean | number
  readonly after: "exit" | "stay"
  readonly env?: NodeJS.ProcessEnv
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
  const wrapperPid = Number(/wrapper=(\d+)/.exec(said())?.[1])
  const childPid = Number(/child=(\d+)/.exec(said())?.[1])
  expect(wrapperPid).toBeGreaterThan(0)
  expect(childPid).toBeGreaterThan(0)
  let reaperPid: number | undefined
  if (options.under === "subreaper") {
    const armed = /subreaper=(\d+) prctl=(-?\d+)/.exec(said())
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

const kidArgv = (mode: "now" | "after-orphan"): ReadonlyArray<string> => [KID, mode]

const webLeg = (): { readonly argv: ReadonlyArray<string>; readonly env: NodeJS.ProcessEnv } => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "olai-tie-dist-"))
  fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html>\n")
  return {
    argv: [path.join(import.meta.dirname, "main.ts"), "web", served()],
    env: {
      OLAI_DIST_DIR: dist,
      KOLU_ACP_AGENT: "",
      XDG_RUNTIME_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "olai-tie-runtime-")),
    },
  }
}

test("the tie is a pid or it is nothing, and nothing is read into silence", () => {
  expect(DIE_WITH_PARENT).toBe("OLAI_DIE_WITH_PARENT")
  expect(parentTie({})).toEqual({ parent: null })
  expect(parentTie({ [DIE_WITH_PARENT]: "" })).toEqual({ parent: null })
  expect(parentTie({ [DIE_WITH_PARENT]: "4321" })).toEqual({ parent: 4321 })
  expect(parentTie({ [DIE_WITH_PARENT]: "1" })).toEqual({ parent: 1 })
  for (const raw of ["yes", "true", "0", "-1", " 12", "12x", "1e3", "99999999999999999999"]) {
    const tie = parentTie({ [DIE_WITH_PARENT]: raw })
    expect(tie.parent).toBeNull()
    expect(tie.parent === null && tie.complaint).toContain(DIE_WITH_PARENT)
  }
})

test("PIN: an UNTIED process survives its spawner exiting", async () => {
  if (process.platform !== "linux") return
  const run = await launch({ argv: kidArgv("after-orphan"), tied: false, after: "exit" })
  try {
    await until(BOUND_MS, "the wrapper to exit", () => gone(run.wrapperPid))
    await until(
      BOUND_MS,
      () => `the kid to reach the guard after being orphaned (log:\n${run.log()})`,
      () => run.log().includes("honored"),
    )
    const orphanedAt = Number(/orphaned ppid=(\d+)/.exec(run.log())?.[1])
    expect(orphanedAt).toBeGreaterThan(0)
    expect(orphanedAt).not.toBe(run.wrapperPid)
    await Bun.sleep(SURVIVE_MS)
    expect(run.log()).not.toContain("SIGTERM")
    expect(alive(run.childPid)).toBe(true)
    const beats = () => (run.log().match(/beat=\d+/g) ?? []).length
    const survived = beats()
    await until(BOUND_MS, "the orphan to keep running after the survival window", () => beats() > survived)
    expect(run.log()).not.toContain("SIGTERM")
  } finally {
    run.stop()
  }
}, BOUND_MS * 3)

test("PIN: a TIED process dies with the spawner it was tied to", async () => {
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
  if (process.platform !== "linux") return
  const run = await launch({
    argv: kidArgv("after-orphan"),
    tied: true,
    after: "exit",
    under: "subreaper",
  })
  try {
    await until(BOUND_MS, "the wrapper to exit", () => gone(run.wrapperPid))
    await until(
      BOUND_MS,
      () => `the kid to be reparented (log:\n${run.log()})`,
      () => /orphaned ppid=\d+/.test(run.log()),
    )
    const orphanedAt = Number(/orphaned ppid=(\d+)/.exec(run.log())?.[1])
    expect(orphanedAt).toBe(Number(run.reaperPid))
    expect(orphanedAt).not.toBe(1)
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
  if (process.platform !== "linux") return
  const run = await launch({ ...webLeg(), tied: 1, after: "stay" })
  try {
    await until(
      BOUND_MS,
      () => `the server to stop itself (log:\n${run.log()})`,
      () => gone(run.childPid),
    )
    expect(run.log()).toContain("olai web: received SIGTERM")
    expect(run.log()).not.toContain("message=serving")
    expect(alive(run.wrapperPid)).toBe(true)
  } finally {
    run.stop()
  }
}, BOUND_MS * 4)

test("PIN: a wrapper-started olai web outlives the wrapper, and goes on serving", async () => {
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
    await Bun.sleep(SURVIVE_MS)
    expect(alive(run.childPid)).toBe(true)
    expect(run.log()).not.toContain("received SIGTERM")
    const page = await fetch(url)
    expect(page.status).toBe(200)
  } finally {
    run.stop()
  }
}, BOUND_MS * 4)

test("olai web dies when its parent dies — BY THE GUARD'S HONOR, not by any side effect", async () => {
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
    expect(run.log()).toContain(
      `honoring SIGTERM from pid ${run.wrapperPid} uid ${process.getuid?.()}`,
    )
    expect(run.log()).toContain("olai web: received SIGTERM")
  } finally {
    run.stop()
  }
}, BOUND_MS * 4)
