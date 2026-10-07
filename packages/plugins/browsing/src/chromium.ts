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
}

export const FLAGS = (profile: string): ReadonlyArray<string> => [
  "--headless=new",
  "--remote-debugging-pipe",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "--window-size=1280,800",
  "--no-first-run",
  "--no-default-browser-check",
  "--password-store=basic",
  "--disable-background-networking",
  "about:blank",
]

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

const tail = (said: string): string => {
  const trimmed = said.trim()
  return trimmed === "" ? "" : ` Chromium said: ${trimmed.slice(-600)}`
}

const exitSentence = (code: number | null, signal: string | null): string =>
  signal !== null ? `Chromium was stopped by ${signal}` : `Chromium exited with code ${code}`

export const launchChromium = (
  executable: string,
  profile: string,
  options: { readonly deadlineMs?: number; readonly graceMs?: number; readonly env?: NodeJS.ProcessEnv } = {},
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
    Effect.sync(() => start(executable, FLAGS(profile), {
      processGroup: true,
      // fds 3 and 4 are the DevTools pipe (`./cdp.ts`).
      stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
      maxBuffer: 16 * 1024,
      ...(options.env === undefined ? {} : { env: options.env }),
    })),
    (child) => Effect.promise(() => child.stop({ graceMs: options.graceMs ?? 2_000 }).catch(() => undefined)),
  )
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
    const fail = (why: string) => settle(Effect.fail(new LaunchFailure({ why: `${why}.${tail(child.err())}` })))
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
    Effect.map(({ code, signal }) => `${exitSentence(code, signal)}.${tail(child.err())}`),
  )
  const pipe = { calls: child.stdio[3] as Writable, answers: child.stdio[4] as Readable }
  return { pid: child.pid!, endpoint, pipe, exited }
})
