/**
 * RUNNING THE PINNED HIMALAYA — one binary, one generated config, one argv
 * shape, and a refusal that carries what the binary said.
 *
 * ## The binary is a resource this build owns
 *
 * `env.vars.OLAI_HIMALAYA` holds one absolute path, baked on the packaged
 * wrapper by `default.nix` from the npins pin. Nothing here resolves a binary:
 * there is no `which`, no PATH walk, no `HIMALAYA_*` environment a person can
 * point somewhere, and a serve that was not started from the Nix build (a plain
 * `bun packages/server/src/main.ts`, say) has no path at all — which is a FAULT
 * the row reports in a sentence naming the build, not an activation failure. A
 * plugin that refused to load would take its own diagnosis away with it.
 *
 * ## The temporary directory, and why the config is rewritten rather than edited
 *
 * `mkdtemp` per activation, mode 0700 (which is what `mkdtemp` gives), holding
 * one `config.toml` written mode 0600. Every access token refresh rewrites the
 * file whole: it is a couple of hundred bytes of derived text, and an editor
 * that had to update one key in place would be a second way for the file and the
 * token in memory to disagree. The directory is removed when the plugin's scope
 * closes, which is when the panel switch withdraws the row — so a serve that
 * never connected and one that was switched off twice over hold no credential on
 * disk at all. The REFRESH TOKEN is the thing that must survive, and it lives in
 * core's `LocalState` file (`./local.ts`), not here.
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

import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

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

export interface Run {
  readonly verb: GmailVerb
  /** The verb's own arguments, in the order its `--help` lists them. */
  readonly args?: ReadonlyArray<string>
}

export interface Himalaya {
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
}

/** Spawn, collect both streams, answer the exit. Never rejects: a binary that
 *  cannot be started at all (ENOENT, EACCES) is an outcome with no status and a
 *  message on stderr — which is the same road a refusal takes, one arm wider. */
const execute = (binary: string, argv: ReadonlyArray<string>): Promise<Outcome> => {
  const { promise, resolve } = Promise.withResolvers<Outcome>()
  const child = spawn(binary, [...argv], { stdio: ["ignore", "pipe", "pipe"] })
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
  child.on("close", (code) => resolve({ code, stdout, stderr }))
  return promise
}

/** The binary's own sentence, in the order of how much it knows. */
const refusedWith = (where: string, done: Outcome): string => {
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
 * (the account machine, `../account.ts`) is the only consumer, it is written in
 * Effects, and what this holds is three mutable facts — the directory once it
 * exists, the token it holds, and the path it was told. A store would be a
 * second place for the same three.
 *
 * The directory is created LAZILY, on the first `useToken`: a serve that has no
 * account yet, or was never given a binary, has no token to write and therefore
 * creates nothing. `close` on a runner that never wrote anything removes
 * nothing.
 */
export const makeHimalaya = (binary: string | undefined): Himalaya => {
  const exe = binary?.trim() ? binary.trim() : undefined
  let directory: string | undefined
  let written: string | undefined

  const configPath = async (): Promise<string> => {
    if (directory === undefined) directory = await mkdtemp(join(tmpdir(), "olai-mail-"))
    return join(directory, CONFIG_FILE)
  }

  return {
    useToken: (input) =>
      Effect.tryPromise({
        try: async () => {
          const rendered = renderConfig(input)
          if (rendered === written && directory !== undefined) return
          const at = await configPath()
          await writeFile(at, rendered, { mode: 0o600 })
          written = rendered
        },
        catch: (error) => new MailRefusal({ reason: `could not write Himalaya's config: ${String(error)}` }),
      }),

    run: (call) =>
      Effect.gen(function*() {
        if (exe === undefined) return yield* Effect.fail(new MailRefusal({ reason: NO_BINARY }))
        if (written === undefined) return yield* Effect.fail(new MailRefusal({ reason: NO_ACCOUNT }))
        const at = yield* Effect.promise(() => configPath())
        const done = yield* Effect.promise(() => execute(exe, himalayaArgv(at, call.verb.path, call.args ?? [])))
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
      written = undefined
      if (at !== undefined) await rm(at, { recursive: true, force: true })
    },
  }
}
