import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { Effect } from "effect"

import { MailRefusal } from "../wire.ts"
import { CONFIG_FILE, renderConfig } from "./config.ts"
import { type GmailVerb, himalayaArgv } from "./verbs.ts"

export const NO_BINARY =
  "this serve was not started from the Nix build, so it has no Himalaya — `nix run`, the packaged binary and the home-manager unit all carry one."

export const NO_ACCOUNT = "no Gmail account is connected to this serve"

export const TIMEOUT_MS = 60 * 1000

/** The three CA-bundle variables are here because the pinned build speaks TLS
 *  through rustls and a NixOS host points those at the system store. */
export const CHILD_ENV: ReadonlyArray<string> = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TZ",
  "LANG",
  "LC_ALL",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NIX_SSL_CERT_FILE",
]

const configRoot = (env: Record<string, string | undefined>): string => {
  const runtime = env["XDG_RUNTIME_DIR"]?.trim()
  return runtime !== undefined && runtime !== "" ? runtime : tmpdir()
}

export interface Run {
  readonly message?: string
  readonly verb: GmailVerb
  readonly args?: ReadonlyArray<string>
}

export interface Himalaya {
  readonly binary: string | undefined
  readonly useToken: (input: { readonly token: string; readonly address: string | null }) => Effect.Effect<void, MailRefusal>
  readonly run: (call: Run) => Effect.Effect<unknown, MailRefusal>
  readonly close: () => Promise<void>
}

interface Outcome {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  readonly timedOut: boolean
}

const execute = (binary: string, argv: ReadonlyArray<string>, env: NodeJS.ProcessEnv): Effect.Effect<Outcome> => Effect.callback<Outcome>((resume) => {
  const { promise, resolve } = Promise.withResolvers<Outcome>()
  const deadline = AbortSignal.timeout(TIMEOUT_MS)
  let timedOut = false
  deadline.addEventListener("abort", () => { timedOut = true })
  const child = spawn(binary, [...argv], { stdio: ["ignore", "pipe", "pipe"], env, signal: deadline })
  let stdout = ""
  let stderr = ""
  child.stdout?.setEncoding("utf8")
  child.stderr?.setEncoding("utf8")
  child.stdout?.on("data", (chunk: string) => { stdout += chunk })
  child.stderr?.on("data", (chunk: string) => { stderr += chunk })
  child.on("error", (error) => { stderr = stderr === "" ? error.message : `${stderr}\n${error.message}` })
  child.on("close", (code) => {
    const done = { code, stdout, stderr, timedOut }
    resolve(done)
    resume(Effect.succeed(done))
  })
  return Effect.promise(async () => { child.kill("SIGKILL"); await promise })
})

const refusedWith = (where: string, done: Outcome): string => {
  if (done.timedOut) return `${where} did not answer within ${TIMEOUT_MS / 1000} seconds`
  const printed = done.stdout.trim()
  if (printed !== "") {
    try {
      const said: unknown = JSON.parse(printed)
      if (typeof said === "object" && said !== null && typeof (said as { error?: unknown }).error === "string") {
        return (said as { error: string }).error
      }
    } catch {
    }
  }
  const complained = done.stderr.trim()
  if (complained !== "") return complained
  return `${where} exited ${done.code === null ? "without a status" : String(done.code)}`
}

export const makeHimalaya = (input: {
  readonly binary: string | undefined
  readonly env: Record<string, string | undefined>
}): Himalaya => {
  const exe = input.binary?.trim() ? input.binary.trim() : undefined
  const childEnv: NodeJS.ProcessEnv = {}
  for (const key of CHILD_ENV) {
    const value = input.env[key]
    if (value !== undefined) childEnv[key] = value
  }
  let holding = false
  let directory: string | undefined

  const configPath = async (): Promise<string> => {
    if (directory === undefined) directory = await mkdtemp(join(configRoot(input.env), "olai-mail-"))
    return join(directory, CONFIG_FILE)
  }

  return {
    binary: exe,

    useToken: (input) =>
      Effect.tryPromise({
        try: async () => {
          const at = await configPath()
          await writeFile(at, renderConfig(input), { mode: 0o600 })
          holding = true
        },
        catch: (error) => new MailRefusal({ reason: `could not write Himalaya's config: ${String(error)}` }),
      }).pipe(Effect.uninterruptible),

    run: (call) =>
      Effect.gen(function*() {
        if (exe === undefined) return yield* Effect.fail(new MailRefusal({ reason: NO_BINARY }))
        if (!holding) return yield* Effect.fail(new MailRefusal({ reason: NO_ACCOUNT }))
        const at = yield* Effect.promise(() => configPath())
        const done = yield* Effect.acquireUseRelease(
          Effect.tryPromise({
            try: async () => {
              if (call.message === undefined) return undefined
              const file = join(dirname(at), `message-${randomUUID()}.eml`)
              try { await writeFile(file, call.message, { mode: 0o600, flag: "wx" }) }
              catch (error) { await rm(file, { force: true }); throw error }
              return file
            },
            catch: error => new MailRefusal({ reason: `could not write draft message: ${String(error)}` }),
          }),
          file => execute(exe, himalayaArgv(at, call.verb.path, [...call.args ?? [], ...file ? ["--", file] : []]), childEnv),
          file => file ? Effect.promise(() => rm(file, { force: true })) : Effect.void,
        )
        if (done.code !== 0) {
          return yield* Effect.fail(new MailRefusal({ reason: refusedWith(exe, done) }))
        }
        return yield* Effect.try({
          try: (): unknown => JSON.parse(done.stdout),
          catch: () => new MailRefusal({ reason: `${exe} answered something that is not the JSON this plugin asked for: ${done.stdout.trim().slice(0, 200)}` }),
        })
      }),

    close: async () => {
      const at = directory
      directory = undefined
      holding = false
      if (at !== undefined) await rm(at, { recursive: true, force: true })
    },
  }
}
