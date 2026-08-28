/**
 * Kolu's terminals, when this host is running one.
 *
 * [Kolu](https://kolu.dev) runs coding agents in terminals and serves them to
 * an agent over MCP (`kolu mcp`, stdio). If this host has one, the panel's
 * agent should be able to see those terminals without anybody configuring
 * anything — so this module answers one question, `Kolu.detect`, and
 * {@link ./agent.ts} adds what it answers to the servers a session is given.
 *
 * **The probe itself is now kolu's** (`@kolu/detect`, juspay/kolu#2168). What
 * used to live here — resolve `kolu` on PATH, start it, handshake, read a cell
 * only a live daemon can answer, keep the absolute path that answered — was
 * knowledge about kolu that this repo was holding on kolu's behalf, and it is
 * the kind that goes stale silently: the two incidents it encodes
 * (juspay/kolu#2146, a bundled build ahead on PATH answering with the same
 * version string; juspay/kolu#2148, a `kolu mcp` that completes the handshake
 * and lists everything with no daemon behind it) are facts about kolu's own
 * builds, discoverable there and not here. So kolu supplies the EVIDENCE and
 * this file keeps the JUDGEMENT, which is the division `mcp-fail-visible`
 * needs and the reason the sentences below did not move with the probe:
 *
 *   - **What is detected is PADI, not kolu's web server.** The browser face
 *     may be running on another machine reaching this host as a remote (the
 *     motivating topology: kolu web elsewhere, this host running only the
 *     daemon — https://kolu.dev/padi/). So "kolu is running here" means the
 *     padi daemon is reachable from here, which `$PADI_SOCKET` names when olai
 *     was launched inside a kolu terminal and kolu resolves for itself when it
 *     was not. Socket discovery is deliberately NOT reimplemented here: kolu
 *     already finds its own default and already says so when a host is running
 *     more than one, and a host that ambiguous is one to leave alone rather
 *     than to guess about.
 *   - **The probe is the detection.** Nothing here trusts a path, a version
 *     string or an exit code — kolu starts the executable, handshakes with it,
 *     and asks it to read a resource only the daemon can answer. An answer is
 *     the evidence, and it is evidence of both halves at once: this binary
 *     speaks the protocol, AND a padi is behind it. Anything else is a no —
 *     because a host without kolu is the ordinary case rather than a fault —
 *     but a no that SAYS WHY ({@link Detected}). It used to be one silent
 *     `false` for all four ways of failing, with the reason destroyed by a
 *     `catch` before anything could report it.
 *   - **The path we probe is the path we hand over.** `kolu` is resolved on
 *     PATH once, and the session is given that absolute path — which is also
 *     what ACP's stdio shape asks for. Handing the bare word would leave the
 *     agent free to resolve it against a different PATH and spawn a different
 *     build than the one that answered.
 *
 * What kolu will NOT decide for us is the last arm: whether an absence is
 * worth reporting. `@kolu/detect` answers `notOnPath` with no reason attached,
 * because the question "was a kolu expected here?" is answered by
 * `PADI_SOCKET` — olai's environment, under olai's service manager — and kolu
 * has no business asserting a fact about our PATH. That judgement, and the
 * sentence it produces ({@link EXPECTED}), stay here.
 *
 * ## The two packages — the map, so a grep for `kolu` is not a reconstruction
 *
 * It was FIVE homes, and the list lived in five headers because a reader who
 * grepped `kolu` landed on whichever came first and had to assemble the rest.
 * The sixth Löwy sitting ended that arrangement rather than documenting it
 * better (`https://github.com/juspay/oss.olai/blob/main/projects/olai/lowy-electricity/debate-2026-08-27.md`), on the human's ruling:
 * *"all of Kolu stuff should be encapsulated out, as a package or more
 * packages, so the non-kolu packages part of Olai doesn't contain Kolu
 * implementation"* — and *"a directory wall can be broken easily by importing;
 * package walls cannot."*
 *
 *   - **`@olai/kolu-client`** — THE DIAL and the wire. The only package that
 *     speaks padi: one socket per server, the standing mirror, the projection
 *     into olai's own shapes. Four doors beside the root — `./wire` (the
 *     vocabulary and the four surface members, which `@olai/surface` spreads
 *     into its spec and re-exports), `./detect` (the spawn-time probe's
 *     surface), `./testlib` (the fake padi and its lifecycle) and `./drivers`
 *     (the two padi-dialing evidence scripts).
 *   - **`@olai/kolu-ui`** — EVERYTHING BROWSER. The Dock row on a `terminal`
 *     property, the live pane, the re-attach policy, the fleet the tab holds
 *     once, and the words the header readout says. Its socket is `KoluUi` —
 *     the app hands over its composed client and a clock, and nothing else
 *     crosses.
 *
 * What is left outside them is not kolu implementation but olai's own
 * judgement ABOUT kolu, and it is worth naming so the distinction survives:
 * `@olai/server`'s `claimants.ts` walks the vault for who OWNS a terminal
 * (outline records, injected into the dial rather than known by it);
 * `@olai/chat`'s `kolu.ts` decides what an absent kolu MEANS, in five English
 * sentences only chat can write, over the probe it reaches through
 * `@olai/kolu-client/detect`; `@olai/web` owns the pill, the block table and
 * the cadence. None of those import kolu, and `scripts/check-kolu-deps.sh`'s
 * fourth assertion is what makes that a fact rather than a habit.
 */

import type { ChildProcess } from "node:child_process"

import {
  detect as detectKolu,
  KOLU_COMMAND,
  PADI_SOCKET_ENV,
  probe as probeKolu,
  type ProbeFailure,
} from "@olai/kolu-client/detect"
import type { NotHere } from "./servers.ts"
import { Effect } from "effect"

/** The executable, its verb, and the variable that says which padi. All three
 *  are kolu's own `.mcp.json` entry — and they are now kolu's own CONSTANTS,
 *  reached through `@olai/kolu-client/detect`, so a rename upstream cannot
 *  leave this file quietly spelling the old one.
 *
 *  That sentence was here before and was FALSE: these were two string literals
 *  and nothing in the tree imported kolu's exports, so the test pinned the
 *  spelled values and an upstream rename would have stayed green. */
const COMMAND = KOLU_COMMAND
const SOCKET = PADI_SOCKET_ENV

/**
 * ... and what it means when that variable is set and there is nothing to run.
 *
 * The one case where "no `kolu` on PATH" is NOT the ordinary case. Absence is
 * normally quiet on purpose — olai auto-detects, nothing declares that a host
 * is meant to have kolu, and a panel complaining on every machine that has
 * never heard of it is the same mistake as saying nothing, reached from the
 * other side. `PADI_SOCKET` is the exception, because it is not a guess: a kolu
 * terminal sets it for the processes it starts, and a person who set it by hand
 * meant it. Something already said a padi is here.
 *
 * That makes this the original incident with a different PATH — and the PATH is
 * exactly what differs, because OLAI'S is not the user's. The home-manager unit
 * starts `olai web` as a systemd user service passing neither (`nix/home/
 * module.nix`), so a kolu that is on a person's interactive PATH need not be on
 * the one this process was started with. Which was the whole shape of the
 * mystery: everything looked right, from the wrong side of an environment.
 */
const EXPECTED = `${SOCKET} names a padi on this host, but no \`kolu\` is on the PATH `
  + `this server was started with — so there is nothing here to reach it through`

/** An MCP server to spawn, in olai's terms — {@link ./agent.ts} renders it
 *  into what ACP wants, the same way it does olai's own. */
export interface Server {
  readonly name: string
  /** Absolute: the file that answered the probe, not a word to resolve again. */
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** What to set when launching it, beyond what it inherits. */
  readonly env: Readonly<Record<string, string>>
}

/**
 * What the probe found — and, when it found nothing, WHY.
 *
 * Three arms rather than a `Server | null`, because "no kolu here" and "a kolu
 * here that would not answer" are different facts about a host and only the
 * second is worth telling anybody about. They used to be the same `null`, with
 * the reason destroyed by a `catch` before anything could have reported it:
 * a spawn that failed, a build that lost the verb, a wedged daemon and a padi
 * that is genuinely not running all arrived as one silent no.
 *
 * The reason is a VALUE and not a log line, which is the whole of what this
 * change is for. Rendering it is `mcp-fail-visible`'s job; having something to
 * render is this one's.
 */
export type Detected =
  /** Kolu is here, and it answered. */
  | { readonly _tag: "kolu"; readonly server: Server }
  /** No `kolu` on PATH, and nothing said there should be — the ordinary case,
   *  and not a fault. */
  | { readonly _tag: "none" }
  /**
   * Something was expected here and is not usable, and what happened.
   *
   * `kolu` is the file that would not answer, or `null` for the one way of
   * failing that never got as far as a file: {@link EXPECTED}, where the
   * environment named a padi and PATH had nothing to reach it with. A path is
   * what a reader most wants and is not always a thing that exists.
   */
  | { readonly _tag: "silent"; readonly kolu: string | null; readonly why: string }

/** The server to hand a session, out of whatever the probe found. */
export const serverOf = (found: Detected): Server | null =>
  found._tag === "kolu" ? found.server : null

/**
 * ... and the other half: what to SAY about a session that did not get it.
 *
 * The two arms that are not a server are not the same answer, which is the
 * whole reason {@link Detected} has three. A host with no kolu on it had
 * nothing go wrong and is owed no sentence — reporting an absence as a fault
 * would put a permanent complaint on the panel of every machine that has never
 * heard of kolu, which is most of them. A kolu that is HERE and would not
 * answer is the one worth telling somebody about, and `null` is what used to be
 * said about both.
 *
 * THE PROBE'S OWN VERDICT ({@link NotHere}) rather than a finished roster row,
 * which is a correction: this shipped returning `@olai/surface`'s wire shape,
 * on #140's argument that there was nothing between here and the wire to
 * translate it. There is now — {@link ./servers.ts} is the module that builds
 * the roster, and it is where all four standings are named and explained,
 * including the rule that this one is never overwritten by anything an agent
 * says. Minting one of the four here put the panel's vocabulary inside a module
 * that is otherwise entirely about detecting kolu, and would make a second
 * optional server's probe a second place that has to know how to spell a row.
 *
 * The path is `null` for exactly one of the ways of failing, and it is the one
 * that never reached a file: a padi named by the environment with no `kolu` on
 * PATH to reach it ({@link EXPECTED}). Every other reason is about a binary
 * that was resolved and started, and names it.
 */
export const missingFrom = (found: Detected): NotHere | null =>
  found._tag === "silent" ? { name: COMMAND, where: found.kolu, why: found.why } : null

/**
 * Kolu's MCP server if this host is running kolu, and why not if it is not.
 *
 * Asked once per conversation rather than once at boot ({@link ./agent.ts}), so
 * a padi started after olai is picked up by the next session instead of at the
 * next restart. It costs one process start and one round trip, on a path that
 * already spawns a subprocess and handshakes with it.
 */
export const detect: Effect.Effect<Detected> = Effect.gen(function*() {
  // Forwarded rather than merely inherited, because the ACP agent is what
  // spawns this and its environment is its own business — the variable travels
  // as part of the entry, exactly as kolu's `.mcp.json` declares it. Unset is
  // not a failure: kolu resolves this host's padi by itself, and says so when
  // there is more than one to choose from (which the probe then reports as
  // "no", correctly — that host is ambiguous, not ours to guess about).
  //
  // Read HERE and passed in, rather than left for `@kolu/detect` to find: this
  // process's environment is olai's fact, and a probe that reached for it
  // itself would be answering a different question than the one the session
  // will ask when it spawns the real server.
  const socket = process.env[SOCKET]
  const expected = socket !== undefined && socket !== ""

  // The LIVE PATH, for the same reason it always was: it is what a spawn would
  // resolve against, and the point of the whole exercise is to probe the file
  // that would actually run.
  const found = yield* Effect.promise(() =>
    detectKolu({
      ...(process.env["PATH"] !== undefined ? { path: process.env["PATH"] } : {}),
      ...(socket !== undefined ? { socket } : {}),
    })
  )

  if (found._tag === "notOnPath") {
    // Nothing to probe — but "nothing to probe" and "nothing was expected" are
    // two facts, and only the second is quiet. See {@link EXPECTED}. This is the
    // arm kolu deliberately hands back bare: it reports that nothing was found,
    // and whether that is a fault is decided here, against olai's own
    // environment.
    if (!expected) return { _tag: "none" }
    yield* Effect.logDebug("a padi is named here but kolu is not on this PATH").pipe(
      Effect.annotateLogs({ [SOCKET]: socket }),
    )
    return { _tag: "silent", kolu: null, why: EXPECTED }
  }

  if (found._tag === "unreachable") {
    const why = whyOf(found.why)
    // The reason is on the line now as well as on the value. It used to say
    // only that "no padi answered", which is the one thing every way of
    // failing had in common and the one thing that never helped.
    yield* Effect.logDebug("kolu is on PATH but did not answer").pipe(
      Effect.annotateLogs({ kolu: found.command, why }),
    )
    return { _tag: "silent", kolu: found.command, why }
  }

  yield* Effect.logInfo("kolu's terminals are on this session").pipe(
    Effect.annotateLogs({ kolu: found.server.command }),
  )
  return {
    _tag: "kolu",
    server: {
      name: COMMAND,
      command: found.server.command,
      args: found.server.args,
      env: found.server.env,
    },
  }
})

/**
 * The sentence for each way a `kolu` that WAS found failed to be this host's.
 *
 * These words are the whole of what a person sees on the strip
 * (`mcp-fail-visible`), so they stay here rather than crossing the package
 * boundary in either direction: kolu reports which way it failed as a TAG and
 * hands back the failing party's own words where there were any, and olai
 * decides how to say it. A kolu that pre-worded these would make four English
 * strings a contract between two repos — the exact coupling the division of
 * labour exists to avoid — and one that only said "it did not work" would put
 * the debug log line on screen, which is what the incident behind this feature
 * was debugged around.
 *
 * The one that carries the most is `refused`: it is what a kolu that reached no
 * daemon sends, so its `said` is a verdict rather than noise — a kolu answering
 * that way is installed, running, and running against nothing.
 */
const whyOf = (failure: ProbeFailure): string => {
  switch (failure._tag) {
    case "couldNotStart":
      // Wherever the refusal reached us — Bun raises it on an event and Node
      // may throw it for a malformed call, and a reader has no business being
      // told which.
      return `it could not be started: ${failure.cause}`
    case "timedOut":
      return `it did not answer within ${failure.deadlineMs / 1000}s`
    case "closed":
      return "it closed the connection without answering"
    case "failed":
      return `talking to it failed: ${failure.cause}`
    case "refused":
      return failure.said !== null
        ? `it refused to read the daemon's identity: ${failure.said}`
        : "it refused to read the daemon's identity, so no padi is behind it"
  }
}

/**
 * Say it all to an already-started `kolu mcp` and answer why it is not this
 * host's — `null` if it answered.
 *
 * The conversation is kolu's now ({@link probeKolu}); the WORDS are still ours,
 * so this is {@link whyOf} over kolu's verdict and nothing else. It stays
 * exported, and the deadline stays a parameter, for the reason it always was: a
 * wedged server and one that hung up reach the same closed pipe, and the only
 * thing telling them apart is which of these two sentences comes back — exactly
 * the sort of thing that rots into the wrong one with every other test still
 * green. Exercising it through `detect` would mean spending a real five seconds
 * on every run forever; a fixture that reads and never answers, given a tenth
 * of one, says the same thing.
 */
export const askOver = async (
  child: ChildProcess,
  deadlineMs: number,
): Promise<string | null> => {
  const verdict = await probeKolu(child, deadlineMs)
  return verdict._tag === "answered" ? null : whyOf(verdict)
}

/** The id kolu sends the identity read under, re-exported because this
 *  package's fixtures answer under it — an answer carrying a different id is
 *  not an answer, and a fixture that spelled the number itself could go on
 *  passing while kolu's moved. */
export { PROBE_ID } from "@olai/kolu-client/detect"
