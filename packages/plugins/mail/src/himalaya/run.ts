/**
 * RUNNING THE PINNED HIMALAYA — one binary, one generated config, one argv
 * shape, and a refusal that carries what the binary said.
 *
 * ## The binary is a resource this build owns
 *
 * `env.vars.OLAI_HIMALAYA` holds one absolute path, baked on the packaged
 * wrapper by this plugin's own `default.nix` (the `OLAI_HIMALAYA` knob) from
 * the npins pin. Nothing here resolves a binary:
 * there is no `which`, no PATH walk, no `HIMALAYA_*` environment a person can
 * point somewhere, and a serve that was not started from the Nix build (a plain
 * `bun packages/server/src/main.ts`, say) has no path at all — which is a FAULT
 * the row reports in a sentence naming the build, not an activation failure. A
 * plugin that refused to load would take its own diagnosis away with it.
 *
 * ## The temporary directory, and why the config is rewritten rather than edited
 *
 * `mkdtemp` per activation, mode 0700 (which is what `mkdtemp` gives), holding
 * one `config.toml` written mode 0600. Draft message files also use 0600,
 * live for exactly one call and are removed after its child exits, including
 * failure, timeout and interruption. `close` still sweeps this one directory. Every access token refresh rewrites the
 * file whole: it is a couple of hundred bytes of derived text, and an editor
 * that had to update one key in place would be a second way for the file and the
 * token in memory to disagree. The directory is removed when the plugin's scope
 * closes, which is when the panel switch withdraws the row — so a serve that
 * never connected and one that was switched off twice over hold no credential on
 * disk at all. The REFRESH TOKEN is the thing that must survive, and it lives in
 * core's `LocalState` file (`./local.ts`), not here.
 *
 * ## What the child is ALLOWED to see, and for how long it may run
 *
 * Two things about this spawn that a spawn gets wrong by default:
 *
 *   - **the environment is an ALLOWLIST, not inherited.** A child inherits the
 *     server's whole environment otherwise, which for olai means
 *     `OLAI_MAIL_OAUTH_SECRET`, `OLAI_SPACES_TOKEN` and every provider key the
 *     engines read (`docs/running.md` lists them) — credentials this process
 *     holds for other purposes entirely, handed to a program that needs none of
 *     them. What Himalaya does need is a PATH, a HOME, a TMPDIR, a timezone,
 *     the locale, and the CA bundle variables a NixOS host sets for rustls;
 *     {@link CHILD_ENV} is that list, and `../server.ts` fills it from the
 *     declared `Env` door rather than from `process.env`.
 *   - **the run is BOUNDED.** A Himalaya stalled on the network (Gmail slow, a
 *     proxy black-holing) never closes, so the caller never returns and the row
 *     sits on the seed `absent` with nothing saying why. {@link TIMEOUT_MS} is
 *     the deadline, the signal kills the child, and the caller gets the same
 *     kind of outcome any other failure has — which the machine treats as a
 *     retry rather than a verdict (`../account.ts`).
 *
 * ## What a refusal is made of
 *
 * The pinned binary with `--json` answers a failure on STDOUT as
 * `{"error": "…", "sources": [], "backtrace": null}` and exits non-zero
 * (`./himalaya/verbs.ts` records both facts). So the sentence a person sees is
 * the binary's own: the JSON `error` where there is one, otherwise whatever
 * stderr carried, otherwise the exit status. This is the difference between
 * *Google refused the token* and *himalaya exited 1* — and the second is what a
 * reader that only looked at stderr would say about every refusal there is.
 */

import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { Effect } from "effect"

import { MailRefusal } from "../wire.ts"
import { CONFIG_FILE, renderConfig } from "./config.ts"
import { type GmailVerb, himalayaArgv } from "./verbs.ts"

/** WHAT A SERVE WITH NO PINNED BINARY IS TOLD. One sentence, naming the three
 *  things that do carry one, because "OLAI_HIMALAYA is not set" is a fact about
 *  an environment and this is advice about a build. */
export const NO_BINARY =
  "this serve was not started from the Nix build, so it has no Himalaya — `nix run`, the packaged binary and the home-manager unit all carry one."

/** ...and what a call made with no account on disk is told. Reached by a tool
 *  or a poll that ran before a connection existed; the panel row says the same
 *  thing in `absent`'s own words. */
export const NO_ACCOUNT = "no Gmail account is connected to this serve"

/** How long one verb may take before the child is killed and the caller told.
 *  A minute is generous for a REST call against Gmail and short enough that a
 *  black-holed connection is a retry rather than a hung row. */
export const TIMEOUT_MS = 60 * 1000

/**
 * WHAT A HIMALAYA CHILD MAY SEE — an allowlist, and the whole of it.
 *
 * PATH and HOME so it can find its own way; TMPDIR so it writes where this
 * serve does; TZ, LANG and LC_ALL so a date it formats reads as a date; the
 * three CA-bundle variables because the pinned build speaks TLS through rustls
 * and a NixOS host points those at the system store. Nothing else — in
 * particular no `OLAI_*` door and no provider key, which this process holds for
 * entirely different purposes.
 */
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

/** The directory a generated config lives in, and the credential with it: the
 *  user's runtime directory when there is one — tmpfs, mode 0700, cleared at
 *  logout — and `tmpdir()` when there is not (`cron`, a container with no
 *  session). Either way `mkdtemp` makes the directory 0700 and `close` removes
 *  it. */
const configRoot = (env: Record<string, string | undefined>): string => {
  const runtime = env["XDG_RUNTIME_DIR"]?.trim()
  return runtime !== undefined && runtime !== "" ? runtime : tmpdir()
}

export interface Run {
  readonly message?: string
  readonly verb: GmailVerb
  /** The verb's own arguments, in the order its `--help` lists them. */
  readonly args?: ReadonlyArray<string>
}

export interface Himalaya {
  /**
   * THE BINARY THIS SERVE WAS GIVEN, or `undefined` when it was handed none —
   * the fact the machine's readiness reading is built on (`../account.ts`).
   * Exposed here rather than passed beside this object, because "is there a
   * pinned Himalaya" is a fact about the runner, which is the thing that
   * spawns it: two copies of the same string is how the two answers drift.
   */
  readonly binary: string | undefined
  /** Write the token the next call runs with. Called on every successful
   *  refresh the token broker makes. */
  readonly useToken: (input: { readonly token: string; readonly address: string | null }) => Effect.Effect<void, MailRefusal>
  /** One verb, its JSON answer already parsed. */
  readonly run: (call: Run) => Effect.Effect<unknown, MailRefusal>
  /** Remove the directory holding the token. Idempotent. */
  readonly close: () => Promise<void>
}

interface Outcome {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  /** Whether the deadline above is what ended this run, which is the one
   *  outcome no exit status can spell: a killed child reports no code, and so
   *  does a binary that was never there. */
  readonly timedOut: boolean
}

/** Spawn, collect both streams, answer the exit. Never rejects: a binary that
 *  cannot be started at all (ENOENT, EACCES) is an outcome with no status and a
 *  message on stderr — which is the same road a refusal takes, one arm wider. */
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
  // `error` and `close` are two events for one failure, and only `close`
  // carries the status — so the error is recorded and the answer waits for the
  // close, which node emits even for a spawn that never happened.
  child.on("error", (error) => { stderr = stderr === "" ? error.message : `${stderr}\n${error.message}` })
  child.on("close", (code) => {
    const done = { code, stdout, stderr, timedOut }
    resolve(done)
    resume(Effect.succeed(done))
  })
  return Effect.promise(async () => { child.kill("SIGKILL"); await promise })
})

/** The binary's own sentence, in the order of how much it knows. */
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
      // Not JSON at all — the binary printed something else on stdout, and the
      // fallbacks below are what a person gets. Deliberately not a defect: the
      // refusal is the answer and the parse is only a way to make it shorter.
    }
  }
  const complained = done.stderr.trim()
  if (complained !== "") return complained
  return `${where} exited ${done.code === null ? "without a status" : String(done.code)}`
}

/**
 * ONE RUNNER PER ACTIVATION. Not an Effect service and not a class: the caller
 * (the account machine and the mail tools) lives in the same activation and is written in
 * Effects, and what this holds is three mutable facts — the directory once it
 * exists, the token it holds, and the path it was told. A store would be a
 * second place for the same three.
 *
 * The directory is created LAZILY, on the first `useToken`: a serve that has no
 * account yet, or was never given a binary, has no token to write and therefore
 * creates nothing. `close` on a runner that never wrote anything removes
 * nothing.
 */
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
  /** WHETHER A TOKEN HAS BEEN WRITTEN — one fact, and the only thing `run`'s
   *  NO_ACCOUNT guard needs. It is deliberately not the token text: the file is
   *  rewritten whole on every refresh (see the header), so a copy of that text
   *  in memory would be a second place for the file and the token to disagree. */
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
        // NO ARM FOR A MISSING BINARY: every caller reaches this through the
        // machine's readiness reading, which is the same fact (`binary` above).
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
