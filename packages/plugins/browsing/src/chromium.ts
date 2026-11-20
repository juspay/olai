/**
 * The endpoint comes from Chromium's own announcement on stderr, `DevTools
 * listening on ws://…`, and not from the profile's `DevToolsActivePort`:
 * Chromium announces BEFORE it writes that file, so a reader woken by the
 * announcement races the write and loses.
 */
import { run, start, type Child } from "@kolu/child"
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
  readonly endpoint: string
  readonly pipe: DevToolsPipe
  readonly exited: Effect.Effect<string>
}

/**
 * THE USER AGENT A HEADED CHROMIUM OF THIS VERSION SENDS, in Chrome's reduced
 * format: headless mode announces itself as `HeadlessChrome/<v>`, and sites
 * refuse it (x.com answers 403).
 */
export const headedUserAgent = (major: number, platform: NodeJS.Platform = process.platform): string =>
  `Mozilla/5.0 (${platform === "darwin" ? "Macintosh; Intel Mac OS X 10_15_7" : "X11; Linux x86_64"}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`

export const majorOf = (said: string): number | null => {
  const found = /\b(\d+)\.\d+\.\d+\.\d+\b/.exec(said)
  return found === null ? null : Number(found[1])
}

export const FLAGS = (profile: string, userAgent: string): ReadonlyArray<string> => [
  "--headless=new",
  "--remote-debugging-pipe",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  `--window-size=${WINDOW.width},${WINDOW.height}`,
  "--no-first-run",
  "--no-default-browser-check",
  // The profile's cookie key, without the OS secret store: `basic` on Linux,
  // the mock keychain on macOS (each flag is ignored by the other). Under a
  // service with no UI the real Keychain lookup blocks or prompts, and every
  // page load waits on it.
  "--password-store=basic",
  "--use-mock-keychain",
  "--disable-background-networking",
  `--user-agent=${userAgent}`,
  "about:blank",
]

/**
 * Chromium's sandbox needs a setuid helper or unprivileged user namespaces; a
 * Nix build sandbox (GitHub's hosted runners) and a hardened pod (seccomp
 * `RuntimeDefault`, every capability dropped, no privilege escalation) have
 * neither, and Chromium aborts with `No usable sandbox!`. Shared memory and a
 * GPU are missing there too.
 */
export const WITHOUT_ITS_OWN_SANDBOX: ReadonlyArray<string> = ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]

export const SANDBOX_KNOB = "OLAI_BROWSER_CHROMIUM_SANDBOX"

/**
 * NOT on/off, and not yes/no or true/false: all six are YAML 1.1 booleans. A
 * Kubernetes manifest carrying `value: off` reached k3s (and every Go YAML
 * reader) as `false`, the env entry was rejected ("unrecognized type:
 * string") and never reached the pod. Two plain words survive any manifest
 * unquoted.
 */
export const sandboxFlags = (value: string | undefined): ReadonlyArray<string> | { readonly why: string } => {
  const said = value?.trim() ?? ""
  if (said === "" || said === "chromium") return []
  if (said === "container") return WITHOUT_ITS_OWN_SANDBOX
  return {
    why: `${SANDBOX_KNOB} is ${JSON.stringify(said)}; it takes chromium (Chromium's own sandbox, the default) or container (the container is the sandbox). Not on/off: YAML reads those, and yes/no and true/false, as booleans, and a manifest then drops the variable.`,
  }
}

const NO_SANDBOX_HINT = ` Chromium's own sandbox cannot start on this host (it needs unprivileged user namespaces or a setuid helper). If a container is already the boundary, set ${SANDBOX_KNOB}=container; the browsing docs say what that gives up.`

export const isExecutable = (path: string): boolean => {
  try {
    if (!isAbsolute(path) || !statSync(path).isFile()) return false
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

const DIAGNOSTIC = /FATAL|ERROR:|Check failed|No usable sandbox/i

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
      await rm(port, { force: true })
    },
    catch: (cause) => new LaunchFailure({ why: `The browser profile could not be prepared: ${String(cause)}.` }),
  })
  const userAgent = yield* Effect.tryPromise({
    try: () => run(executable, ["--version"], { timeout: 15_000 }),
    catch: (cause) => new LaunchFailure({ why: `Chromium did not say its version: ${String(cause)}.` }),
  }).pipe(Effect.flatMap((said) => {
    const major = majorOf(said.out)
    return major === null
      ? Effect.fail(new LaunchFailure({ why: `Chromium did not say its version (\`--version\` answered ${JSON.stringify(said.said.slice(0, 200))}).` }))
      : Effect.succeed(headedUserAgent(major))
  }))
  const child: Child = yield* Effect.acquireRelease(
    Effect.sync(() => start(executable, [...FLAGS(profile, userAgent), ...(options.extraFlags ?? [])], {
      processGroup: true,
      // fds 3 and 4 are the DevTools pipe (`./cdp.ts`).
      stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
      maxBuffer: 16 * 1024,
      ...(options.env === undefined ? {} : { env: options.env }),
    })),
    (child) => Effect.promise(() => child.stop({ graceMs: options.graceMs ?? 2_000 }).catch(() => undefined)),
  )
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
  return { pid: child.pid!, endpoint, pipe, exited }
})
