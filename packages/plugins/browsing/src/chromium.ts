/**
 * ONE CHROMIUM, launched for as long as the calling scope stands.
 *
 * The full build with `--headless=new`, not the headless shell: real sign-in
 * flows tolerate it far better, and it is the same binary the person would
 * recognise. The process is its own group so the stop reaches its zygote,
 * GPU and renderer children too; release is SIGTERM, a short grace, then
 * SIGKILL, and the child is reaped before the scope says it is closed.
 *
 * The endpoint is Chromium's own announcement on stderr, `DevTools listening
 * on ws://…`, which is the event the wait is for; the clock beside it is a
 * hang detector that fails with what Chromium said. Not the profile's
 * `DevToolsActivePort`: Chromium announces BEFORE it writes that file, so a
 * reader woken by the announcement races the write and loses (the e2e found
 * it). A file left by an earlier run is still removed first, so nothing ever
 * reads a stale one.
 */
import { start, type Child } from "@olai/child"
import { accessSync, constants, statSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { Data, Effect, type Scope } from "effect"
import type { Readable, Writable } from "node:stream"
import type { DevToolsPipe } from "./cdp.ts"
import { WINDOW } from "./wire.ts"

export class LaunchFailure extends Data.TaggedError("LaunchFailure")<{ readonly why: string }> {
  override get message(): string {
    return this.why
  }
}

export interface Launched {
  readonly pid: number
  /** `ws://127.0.0.1:<port>/devtools/browser/<id>` — the agents' door. */
  readonly endpoint: string
  /** olai's own door, whose closing is also Chromium's cue to quit. */
  readonly pipe: DevToolsPipe
  /** Settles with a sentence when the process exits, by any hand. */
  readonly exited: Effect.Effect<string>
  /** What Chromium has said so far, as a failure sentence would quote it. */
  readonly said: () => string
}

export const FLAGS = (profile: string): ReadonlyArray<string> => [
  "--headless=new",
  "--remote-debugging-pipe",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  `--window-size=${WINDOW.width},${WINDOW.height}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--password-store=basic",
  "--disable-background-networking",
  "about:blank",
]

/**
 * CHROMIUM WITHOUT ITS OWN SANDBOX, and only where something else is the
 * sandbox. Chromium's sandbox needs a setuid helper or unprivileged user
 * namespaces; a Nix build sandbox (GitHub's hosted runners) and a hardened
 * pod (seccomp `RuntimeDefault`, every capability dropped, no privilege
 * escalation) have neither, and Chromium aborts with `No usable sandbox!`.
 * Shared memory and a GPU are missing there too.
 *
 * Two callers, and no third: the hermetic `surface.check.ts`, and a person
 * who sets {@link SANDBOX_KNOB} to `off` because their container is the
 * boundary. {@link FLAGS} carries none of these, nothing detects a host and
 * drops them on its behalf, and the default is Chromium's own sandbox.
 * (Playwright's own launches pass `--no-sandbox` by default, which is why the
 * isolated handoff always ran in such a pod.)
 */
export const WITHOUT_ITS_OWN_SANDBOX: ReadonlyArray<string> = ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]

/** The person's switch for {@link WITHOUT_ITS_OWN_SANDBOX}. */
export const SANDBOX_KNOB = "OLAI_BROWSER_CHROMIUM_SANDBOX"

/** The flags the knob asks for: unset, empty or `on` keeps Chromium's own
 *  sandbox; `off` drops it; anything else is a sentence, never a guess. */
export const sandboxFlags = (value: string | undefined): ReadonlyArray<string> | { readonly why: string } => {
  const said = value?.trim() ?? ""
  if (said === "" || said === "on") return []
  if (said === "off") return WITHOUT_ITS_OWN_SANDBOX
  return { why: `${SANDBOX_KNOB} is ${JSON.stringify(said)}; it takes on or off.` }
}

/** Said after Chromium's own words when its sandbox could not start. */
const NO_SANDBOX_HINT = ` Chromium's own sandbox cannot start on this host (it needs unprivileged user namespaces or a setuid helper). If a container is already the boundary, set ${SANDBOX_KNOB}=off; the browsing docs say what that gives up.`

/** Is this an absolute executable file? The knob's own check, the probe's
 *  rule for `OLAI_BROWSER_MCP` one row over. */
export const isExecutable = (path: string): boolean => {
  try {
    if (!isAbsolute(path) || !statSync(path).isFile()) return false
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Chromium's lines that say WHY it stopped — a `FATAL`, a failed `CHECK`,
 *  the sandbox's complaint — as opposed to the stack trace and registers that
 *  follow them and fill any tail. */
const DIAGNOSTIC = /FATAL|ERROR:|Check failed|sandbox/i

/** What Chromium said, for a failure sentence: its first diagnostic lines,
 *  kept as they arrived however much followed, then the last of the rest —
 *  and, when the reason is its sandbox, the knob that answers it. */
export const tail = (diagnostics: ReadonlyArray<string>, said: string): string => {
  const rest = said.trim().slice(-300)
  const words = [...diagnostics, ...(rest === "" ? [] : [`… ${rest}`])]
  const hint = diagnostics.some((line) => /No usable sandbox/i.test(line)) ? NO_SANDBOX_HINT : ""
  return words.length === 0 ? hint : ` Chromium said: ${words.join(" ")}${hint}`
}

const exitSentence = (code: number | null, signal: string | null): string =>
  signal !== null ? `Chromium was stopped by ${signal}` : `Chromium exited with code ${code}`

export const launchChromium = (
  executable: string,
  profile: string,
  options: {
    readonly deadlineMs?: number
    readonly graceMs?: number
    readonly env?: NodeJS.ProcessEnv
    /** Flags after {@link FLAGS}: {@link WITHOUT_ITS_OWN_SANDBOX} when the
     *  person said so, and the hermetic check's own. */
    readonly extraFlags?: ReadonlyArray<string>
  } = {},
): Effect.Effect<Launched, LaunchFailure, Scope.Scope> => Effect.gen(function*() {
  if (!isExecutable(executable)) {
    return yield* new LaunchFailure({ why: "OLAI_BROWSER_CHROMIUM does not name an absolute executable file." })
  }
  const port = join(profile, "DevToolsActivePort")
  yield* Effect.tryPromise({
    try: async () => {
      await mkdir(profile, { recursive: true, mode: 0o700 })
      // A file left by the last run would answer before this one listens.
      await rm(port, { force: true })
    },
    catch: (cause) => new LaunchFailure({ why: `The browser profile could not be prepared: ${String(cause)}.` }),
  })
  const child: Child = yield* Effect.acquireRelease(
    Effect.sync(() => start(executable, [...FLAGS(profile), ...(options.extraFlags ?? [])], {
      processGroup: true,
      // fds 3 and 4 are the DevTools pipe (`./cdp.ts`).
      stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
      maxBuffer: 16 * 1024,
      ...(options.env === undefined ? {} : { env: options.env }),
    })),
    (child) => Effect.promise(() => child.stop({ graceMs: options.graceMs ?? 2_000 }).catch(() => undefined)),
  )
  // The diagnostic lines, kept for the process's whole life: a crash long
  // after launch is reported with them too.
  const diagnostics: Array<string> = []
  let partial = ""
  child.stderr?.on("data", (chunk: string) => {
    const lines = (partial + chunk).split("\n")
    partial = lines.pop() ?? ""
    for (const line of lines) {
      if (diagnostics.length < 3 && DIAGNOSTIC.test(line)) diagnostics.push(line.trim().slice(0, 300))
    }
  })
  const endpoint = yield* Effect.callback<string, LaunchFailure>((resume) => {
    let settled = false
    const dispose = () => {
      settled = true
      clearTimeout(timer)
      child.stderr?.off("data", heard)
    }
    const settle = (outcome: Effect.Effect<string, LaunchFailure>) => {
      if (settled) return
      dispose()
      resume(outcome)
    }
    const fail = (why: string) => settle(Effect.fail(new LaunchFailure({ why: `${why}.${tail(diagnostics, child.err())}` })))
    const heard = () => {
      const said = /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[\w-]+)/.exec(child.err())
      if (said !== null) settle(Effect.succeed(said[1]!))
    }
    const timer = setTimeout(() => fail(`Chromium did not open DevTools within ${(options.deadlineMs ?? 20_000) / 1000} seconds`), options.deadlineMs ?? 20_000)
    child.stderr?.on("data", heard)
    void child.unstartable.then((why) => fail(`Chromium could not start: ${why}`))
    void child.closed.then(({ code, signal }) => fail(`${exitSentence(code, signal)} before opening DevTools`))
    heard()
    return Effect.sync(dispose)
  })
  const exited = Effect.promise(() => child.closed).pipe(
    Effect.map(({ code, signal }) => `${exitSentence(code, signal)}.${tail(diagnostics, child.err())}`),
  )
  const pipe = { calls: child.stdio[3] as Writable, answers: child.stdio[4] as Readable }
  return { pid: child.pid!, endpoint, pipe, exited, said: () => tail(diagnostics, child.err()) }
})
