/**
 * IS ODU'S `mcp` HERE — and, when it is not and a conversation would have
 * been handed it anyway, the sentence a person is owed about it.
 *
 * ## The division this file IS: the subprocess supplies the evidence, olai
 * the judgement
 *
 * `olai-plugin-kolu`'s `./probe.ts` argues the shape at full length, and every
 * ruling in it carries unchanged: resolve the binary on the PATH the session's
 * OWN spawn will use, start it, speak the protocol, and ask it a question
 * only the right build answers. **Nothing here trusts a path or a version
 * string**: an `odu` that lies on PATH without being one is not this host's,
 * and the map of what that looks like in practice is kolu's two incidents —
 * a stale bundled build answering with the same version string
 * (juspay/kolu#2146), and a server listing every tool with nothing behind it
 * (juspay/kolu#2148).
 *
 * What the question IS differs, and the difference is this package's whole
 * reason. Kolu asks a server for a cell only a live padi can answer, because
 * the daemon is what could be absent. odu's `mcp` BEARS no daemon — what
 * could be absent is the SHAPE this olai was written against: a conversation
 * spans many lanes, so no verb may aim at the server's own cwd (an `mcp` that
 * does binds olai's served root, and every call a lane asked for lands there
 * instead, which is worse than no tools at all). So the round trip is
 * `initialize` + `tools/list`, and the check reads the answer.
 *
 * WHAT "AIMED" MEANS MOVED ONCE, and the move is why {@link VERBS} is a table
 * rather than a list. juspay/odu#97 settled the first answer — every verb
 * takes a per-call `checkout` — and juspay/odu#105 replaced it with a sharper
 * one: a run is now addressed GLOBALLY by `runId`, so only the verbs that name
 * a DIRECTORY still carry `checkout`, and the ones that name a RUN carry an id
 * that was never anybody's cwd. Both are aimed; they are aimed by different
 * keys. So the table pairs each verb with the key that aims it, and the check
 * is per verb — which is strictly more than the old "every verb takes
 * `checkout`" could say, because it also catches a `run_wait` that grew a
 * `checkout` back.
 *
 * The shared stdio transport is a stateless factory in @olai/plugin-kit.
 * This plugin retains the verbs, their required inputs and every sentence.
 *
 * ## Why it is on the `./server` door and not on the manifest
 *
 * It starts a subprocess, and the manifest is the door the BROWSER opens —
 * `olai-plugin-kolu`'s `./probe.ts` argues both why that is the rule and why
 * it is on this door.
 */

import { askStdioMcp, type Verdict } from "@olai/plugin-kit/stdio-mcp"
export { askOver, type Verdict } from "@olai/plugin-kit/stdio-mcp"
import { accessSync, constants } from "node:fs"
import { delimiter, join } from "node:path"

import { Effect, type Scope } from "effect"

/**
 * AN MCP SERVER TO HAND A SESSION, and what a person is owed about one they
 * did not get — this package's own spelling of the two shapes core carries.
 *
 * Re-declared here rather than imported, for the exact cycle
 * `olai-plugin-kolu`'s `./probe.ts` argues: `@olai/plugin-api` imports THIS
 * package, so an import back is a shape the manifests could not express. The
 * fit is proved at the registry, by `satisfies`.
 */
export interface StdioServer {
  readonly name: string
  /** Absolute: the file that answered the probe, not a word to resolve again. */
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** What to set when launching it, beyond what it inherits. */
  readonly env: Readonly<Record<string, string>>
}

/** ...and the other half. `where` is `null` in exactly one arm: a PATH with
 *  no `odu` on it at all ({@link probing}), where nothing was resolved so there
 *  is nothing to name. Every OTHER way an odu can fail begins by having been
 *  resolved and started, and a `where` is the first thing that path takes.
 *  `why` is a WHOLE SENTENCE and it is this package's — core displays it and
 *  never composes one. */
export interface NotHere {
  readonly name: string
  readonly where: string | null
  readonly why: string
}

/** WHAT THE PROBE FOUND — both halves at once, because they are one reading:
 *  a caller that asked once for the entry to hand over and again for the
 *  sentence would start `odu` twice per conversation and could answer the two
 *  questions about two different moments. */
export interface Probed {
  /** The server to hand a session, or `null` where there is none to hand. */
  readonly server: StdioServer | null
  /** What a person is owed about the one they did not get, or `null` the
   *  moment a server IS handed over. There is no quiet-absence case for odu:
   *  a packaged olai bakes the binary onto the server's PATH (nix/odu.nix),
   *  so a resolve that finds nothing is a fact somebody must see, never an
   *  ordinary state. */
  readonly missing: NotHere | null
}

/** The command, spelled ONCE — the probe resolves it, the handed-over server
 *  runs it, and a sentence names it. */
export const ODU_COMMAND = "odu"

/** The one's argv — `odu mcp`. */
const ARGS = ["mcp"] as const

/**
 * THE VERBS A CONVERSATION IS PROMISED, EACH WITH THE INPUT KEY THAT AIMS IT
 * — the dispatch's own list: with these, an agent can start a run, retry one
 * node, stop one, wait, and hold a venue across runs. An answer without them
 * is not an answer to the question this probe asks: presence is checked
 * against THIS table and nothing wider, so a NEWER odu shipping more is a fine
 * answer and this table never has to move for it.
 *
 * THE SIX CAPABILITIES ARE THE SAME SIX they have always been; only the
 * spellings moved, at juspay/odu#105 — `run`→`run_start`,
 * `node_rerun`→`run_retry`, `node_cancel`→`run_cancel`,
 * `wait_for_settle`→`run_wait`, `lease`→`venue_hold`,
 * `release`→`venue_release`. The list is deliberately not widened while
 * renaming it: `log_read`, `run_read`, `pipeline_read`, `venue_probe` and the
 * catalog verbs are real and useful, but a conversation was never promised
 * them, and a promise is the thing this table states.
 *
 * THE VALUE IS THE AIM. A verb that names a DIRECTORY takes `checkout` — an
 * absolute path, so the server stays parked while the agent aims per call. A
 * verb that names a RUN takes `runId`, which odu's catalog makes global: it
 * resolves to the same run from any directory, so there is no cwd for it to
 * fall back to. Either key is a verb that cannot quietly mean "here"; a verb
 * with NEITHER is the failure this probe exists to catch.
 */
const VERBS = {
  run_start: "checkout",
  run_retry: "runId",
  run_cancel: "runId",
  run_wait: "runId",
  venue_hold: "checkout",
  venue_release: "checkout",
} as const

/** The table's keys, in its own order — the sentences below name them in the
 *  order they are written above, which is the order the capabilities were
 *  argued in. */
const VERB_NAMES = Object.keys(VERBS) as ReadonlyArray<keyof typeof VERBS>

/** The transport deadline, in milliseconds: cohort to kolu's own. A wedged
 *  `odu mcp` and an honest one reach distinction inside five seconds. */
const DEADLINE_MS = 5_000

// ── The evidence ────────────────────────────────────────────────────────

/**
 * WHAT ONE `odu mcp` CHILD ANSWERED, or the one way it failed to.
 *
 * A TAGGED UNION rather than a throw per way: the half that SAYS these to a
 * person is one function over the tags, and the whole point of the probe is
 * that the four ways of failing and the answer travel one channel so the
 * judgement is a fold and never a catch.
 */
/**
 * WHERE THE PROBED `odu` IS, or `null` for an answer of "nowhere".
 *
 * The LIVE PATH, walked the way execvp would: the first EXECUTABLE `odu`
 * wins, and a file that is there but will not run does not shadow the ones
 * behind it (bash's own `EACCES`-pass behaviour, restated honestly rather
 * than inherited from a spawn error two steps later).
 */
const resolveOn = (path: string | undefined): string | null => {
  if (path === undefined) return null
  for (const entry of path.split(delimiter)) {
    if (entry === "") continue
    const candidate = join(entry, ODU_COMMAND)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      continue
    }
  }
  return null
}

/** The one sentence for the resolve that found NOTHING — the command named,
 *  said not to be on the server's PATH, with the build's promise beside it
 *  so the row is also the directions out ({@link probing}'s header argues it).
 *  kolu's `EXPECTED` is the same sentence one appliance over, pinned there
 *  to `PADI_SOCKET`; here the bake itself is what expects. The second clause
 *  states the promise and STOPS — any diagnosis (a serve started outside
 *  the build; `OLAI_ODU_BIN` deliberately empty) is this serve's own to
 *  judge, and a sentence that can be wrong is worse than a shorter one. */
const NOT_FOUND = `no \`${ODU_COMMAND}\` is on the PATH this server was started with`
  + " — a packaged olai carries one"

/**
 * ASK THIS HOST — one resolve, one spawn, one round trip, per conversation.
 *
 * Asked FRESH every time a session is opened for `olai-plugin-kolu`'s
 * `probe`'s reason: an odu installed after this server was started is picked
 * up by the next conversation instead of at the next restart.
 *
 * THE ENVIRONMENT IS HANDED IN and never reached for: it is what the
 * session's own spawn will resolve against, and a composition root is the one
 * place a real `process.env` belongs.
 *
 * ## Absence is LOUD, because a packaged olai carries an odu
 *
 * The build bakes the pinned `odu` binary onto the server's PATH (the
 * wrapper in the root default.nix, from nix/odu.nix), so every documented
 * start — `nix run`, the packaged binary, `just serve`, the home-manager
 * unit — resolves one. A probe that finds NOTHING is therefore not the
 * ordinary case; it is a serve that declined the build's own answer (a
 * bare `bun` invocation, somebody's hand-rolled unit, `OLAI_ODU_BIN`
 * emptied on purpose — the plugin cannot tell them apart and does not
 * try: the sentence carries the fact, the diagnosis is theirs), and the
 * difference between the two is exactly what a person on the second kind
 * needs to see rather than to infer from a conversation that simply has
 * no CI verbs. Silence here was the production incident: a host that ran all
 * its odu through `nix run github:juspay/odu` installed nothing, and the
 * quiet arm meant the feature could never fire while the panel said
 * nothing about why. The sentence is odu's own spelling of kolu's
 * `EXPECTED` one appliance over: the command named, said not to be on
 * the server's PATH, with `where` null because nothing was resolved.
 *
 * ## A found one that will not answer is a sentence
 *
 * Every path from "resolved" to "answered" that is not "answered" is ONE of
 * them, and they are the probe's own (`{@link asking}`). The tool-surface
 * check is the one arm with two sentences of its own, because the two things
 * it can find are two different fixes: an odu so old the verbs were never
 * there, and one new enough to run a run but too old to AIM one.
 */
export const probing = (
  env: Record<string, string | undefined>,
): Effect.Effect<Probed, never, Scope.Scope> =>
  Effect.gen(function*() {
    const found = resolveOn(env["PATH"])
    if (found === null) return { server: null, missing: { name: ODU_COMMAND, where: null, why: NOT_FOUND } }

    const verdict = yield* askStdioMcp({ command: found, args: ARGS, timeout: DEADLINE_MS })

    if (verdict._tag !== "answered") {
      return { server: null, missing: { name: ODU_COMMAND, where: found, why: whyOf(verdict) } }
    }
    const names = new Set(verdict.tools.map((tool) => tool.name))
    const absent = VERB_NAMES.filter((verb) => !names.has(verb))
    if (absent.length > 0) {
      return {
        server: null,
        missing: {
          name: ODU_COMMAND,
          where: found,
          why: `it answers, but its tool surface is missing ${absent.map((one) => `\`${one}\``).join(", ")}`
            + ` — this olai hands a conversation ${VERB_NAMES.map((one) => `\`${one}\``).join(", ")},`
            + " and one of the two needs an upgrade",
        },
      }
    }
    const aimless = VERB_NAMES.find((verb) => {
      const tool = verdict.tools.find((one) => one.name === verb)
      return tool !== undefined && !tool.inputs.includes(VERBS[verb])
    })
    if (aimless !== undefined) {
      return {
        server: null,
        missing: {
          name: ODU_COMMAND,
          where: found,
          why: `it answers, but \`${aimless}\` takes no \`${VERBS[aimless]}\``
            + " — a conversation spans many lanes, and this build could only ever aim at olai's own served directory;"
            + " one of the two needs an upgrade",
        },
      }
    }
    return {
      server: { name: ODU_COMMAND, command: found, args: [...ARGS], env: {} },
      missing: null,
    }
  })

/** The sentence per WAY a found `odu` failed — whole sentences, because core
 *  displays them and composes none (`olai-plugin-kolu`'s `whyOf` argues the
 *  rule at length). */
const whyOf = (verdict: Exclude<Verdict, { _tag: "answered" }>): string => {
  switch (verdict._tag) {
    case "couldNotStart":
      return `it could not be started: ${verdict.cause}`
    case "timedOut":
      return `it did not answer within ${verdict.deadlineMs / 1000}s`
    case "closed":
      return "it closed the connection without answering"
    case "failed":
      return `talking to it failed: ${verdict.cause}`
  }
}
