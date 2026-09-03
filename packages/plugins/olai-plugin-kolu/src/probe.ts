/**
 * IS KOLU RUNNING HERE — and, when it is not and should have been, the
 * sentence a person is owed about it.
 *
 * ## The division this file IS: kolu supplies the evidence, olai the judgement
 *
 * The probe's plumbing is kolu's (`@olai/kolu-client/detect`, over
 * `@kolu/detect`, juspay/kolu#2168): resolve `kolu` on PATH, start it,
 * handshake, read a cell only a live daemon can answer, keep the absolute path
 * that answered. That was knowledge about kolu this repo used to hold on kolu's
 * behalf, and it is the kind that goes stale silently — the two incidents it
 * encodes (juspay/kolu#2146, a bundled build ahead on PATH answering with the
 * same version string; juspay/kolu#2148, a `kolu mcp` that completes the
 * handshake and lists everything with no daemon behind it) are facts about
 * kolu's own builds, discoverable there and not here.
 *
 * What is left is the JUDGEMENT, and every line of it is olai's:
 *
 *   - **What is detected is PADI, not kolu's web server.** The browser face may
 *     be running on another machine reaching this host as a remote (the
 *     motivating topology: kolu web elsewhere, this host running only the
 *     daemon — https://kolu.dev/padi/). So "kolu is running here" means the padi
 *     daemon is reachable from here, which `$PADI_SOCKET` names when olai was
 *     launched inside a kolu terminal and kolu resolves for itself when it was
 *     not. Socket discovery is deliberately NOT reimplemented: kolu already
 *     finds its own default and already says so when a host is running more than
 *     one, and a host that ambiguous is one to leave alone rather than guess
 *     about.
 *   - **The probe is the detection.** Nothing here trusts a path, a version
 *     string or an exit code. An answer is evidence of both halves at once: this
 *     binary speaks the protocol, AND a padi is behind it.
 *   - **The path probed is the path handed over.** The session gets the absolute
 *     file that answered, which is also what ACP's stdio shape asks for. Handing
 *     the bare word would leave the agent free to resolve it against a different
 *     PATH and spawn a different build than the one that answered.
 *   - **Whether an absence is a FAULT** ({@link EXPECTED}) — the one arm kolu
 *     declines to decide, because "was a kolu expected here?" is answered by
 *     `PADI_SOCKET`, which is olai's environment under olai's service manager,
 *     and kolu has no business asserting a fact about our PATH.
 *   - **The five SENTENCES** ({@link whyOf}) — one per way a `kolu` that WAS
 *     found failed to be this host's.
 *
 * ## Why this is the plugin's file and no longer `@olai/chat`'s
 *
 * It was `packages/chat/src/kolu.ts`, and 341 lines of it were the word `kolu`
 * inside a package whose whole subject is one conversation with one ACP agent.
 * The seam that stays there is generic — a list of things that answer *is your
 * tool here, and what am I owed if not* — and what a chat does with the answer
 * is hand the server over and DISPLAY the sentence. Composing that sentence is
 * the thing no general package can do: the five ways a padi fails and the ways
 * a coordinator fails have nothing in common but that they failed, and a
 * sentence built out of that shared nothing is the debug line on a screen, which
 * is exactly what the incident behind `mcp-fail-visible` was debugged around.
 *
 * ## Why it is on the `./server` door and not on the manifest
 *
 * It starts a subprocess. The manifest is the door the BROWSER opens
 * ({@link ./plugin.ts}), so a probe reachable through it would put
 * `node:child_process` — and kolu's whole detect surface — into the tab's
 * bundle. That is the same graph split the runtime half takes, for the same
 * reason, and `packages/bundle/src/fence.test.ts` walks both closures.
 */

import type { ChildProcess } from "node:child_process"

import {
  detect as detectKolu,
  KOLU_COMMAND,
  PADI_SOCKET_ENV,
  probe as probeKolu,
  type ProbeFailure,
} from "@olai/kolu-client/detect"

/**
 * AN MCP SERVER TO HAND A SESSION, and what a person is owed about one they did
 * not get — this package's own spelling of the two shapes core carries.
 *
 * Re-declared here rather than imported, and that is physics rather than taste:
 * `@olai/plugin-api` imports this package, so an import back would be a cycle the
 * manifests could not express. The fit is proved at the registry, by
 * `satisfies`, exactly as the manifest's is.
 *
 * The alternative was to leave {@link probe}'s return type inferred and let that
 * same `satisfies` be the only check. It loses the thing this repo asks of every
 * other plugin-side annotation ({@link ./server.ts}'s
 * `ImplementSurfaceDeps<typeof surface.spec>`): a shape that drifted would be a
 * type error in `@olai/plugin-api`'s registry rather than in the file that drifted.
 */
export interface StdioServer {
  readonly name: string
  /** Absolute: the file that answered the probe, not a word to resolve again. */
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** What to set when launching it, beyond what it inherits. */
  readonly env: Readonly<Record<string, string>>
}

/** ...and the other half. `where` is `null` for the one way of failing that
 *  never reached a file ({@link EXPECTED}); every other reason is about a binary
 *  that was resolved and started, and names it. `why` is a WHOLE SENTENCE and it
 *  is this package's — core displays it and never composes one. */
export interface NotHere {
  readonly name: string
  readonly where: string | null
  readonly why: string
}

/** WHAT THE PROBE FOUND — both halves at once, because they are one reading.
 *
 *  Two fields rather than a union, and the invariant has an incident behind it
 *  (`@olai/chat`'s `agent.ts`: one probe, two reads). A caller that asked once
 *  for the server to hand over and again for the sentence would start `kolu`
 *  twice per conversation and could answer the two questions about two
 *  different moments. */
export interface Probed {
  /** The server to hand a session, or `null` where there is none to hand. */
  readonly server: StdioServer | null
  /** What a person is owed about the one they did not get, or `null` where an
   *  absence is the ordinary case and no fault. */
  readonly missing: NotHere | null
}

/**
 * WHEN AN ABSENT KOLU IS A FAULT: `$PADI_SOCKET` is set and there is nothing on
 * PATH to reach it through.
 *
 * The one case where "no `kolu` on PATH" is NOT the ordinary case. Absence is
 * normally quiet on purpose — olai auto-detects, nothing declares that a host is
 * meant to have kolu, and a panel complaining on every machine that has never
 * heard of it is the same mistake as saying nothing, reached from the other
 * side. `PADI_SOCKET` is the exception, because it is not a guess: a kolu
 * terminal sets it for the processes it starts, and a person who set it by hand
 * meant it. Something already said a padi is here.
 *
 * That makes this the original incident with a different PATH — and the PATH is
 * exactly what differs, because OLAI'S is not the user's. The home-manager unit
 * starts `olai web` as a systemd user service passing neither (`nix/home/
 * module.nix`), so a kolu on a person's interactive PATH need not be on the one
 * this process was started with. Which was the whole shape of the mystery:
 * everything looked right, from the wrong side of an environment.
 */
const EXPECTED = `${PADI_SOCKET_ENV} names a padi on this host, but no \`kolu\` is on the PATH `
  + `this server was started with — so there is nothing here to reach it through`

/**
 * ASK THIS HOST — one process start and one round trip, per conversation.
 *
 * Asked FRESH every time a session is opened rather than once at boot, so a padi
 * started after olai is picked up by the next conversation instead of at the
 * next restart. It costs what it costs on a path that already spawns a
 * subprocess and handshakes with it.
 *
 * THE ENVIRONMENT IS HANDED IN and not reached for, which is the rule every seam
 * in this tree is built on and here it is also the only way the answer can be
 * right: what this reads is what a session's spawn will resolve against, and a
 * probe that read a different environment than the one the server will be
 * started in would be answering a different question. The composition root is
 * the one place a real `process.env` is touched.
 */
export const probe = async (
  env: Record<string, string | undefined>,
): Promise<Probed> => {
  // Forwarded rather than merely inherited, because the ACP agent is what spawns
  // this and its environment is its own business — the variable travels as part
  // of the entry, exactly as kolu's `.mcp.json` declares it. Unset is not a
  // failure: kolu resolves this host's padi by itself, and says so when there is
  // more than one to choose from (which the probe then reports as "no",
  // correctly — that host is ambiguous, not ours to guess about).
  const socket = env[PADI_SOCKET_ENV]
  const expected = socket !== undefined && socket !== ""

  // The LIVE PATH, for the same reason it always was: it is what a spawn would
  // resolve against, and the point of the whole exercise is to probe the file
  // that would actually run.
  const found = await detectKolu({
    ...(env["PATH"] !== undefined ? { path: env["PATH"] } : {}),
    ...(socket !== undefined ? { socket } : {}),
  })

  if (found._tag === "notOnPath") {
    // Nothing to probe — but "nothing to probe" and "nothing was expected" are
    // two facts, and only the second is quiet. This is the arm kolu deliberately
    // hands back bare: it reports that nothing was found, and whether that is a
    // fault is decided here, against olai's own environment.
    return expected
      ? { server: null, missing: { name: KOLU_COMMAND, where: null, why: EXPECTED } }
      : { server: null, missing: null }
  }

  if (found._tag === "unreachable") {
    return {
      server: null,
      missing: { name: KOLU_COMMAND, where: found.command, why: whyOf(found.why) },
    }
  }

  return {
    server: {
      name: KOLU_COMMAND,
      command: found.server.command,
      args: found.server.args,
      env: found.server.env,
    },
    missing: null,
  }
}

/**
 * The sentence for each way a `kolu` that WAS found failed to be this host's.
 *
 * These words are the whole of what a person sees on the strip
 * (`mcp-fail-visible`), so they stay on this side of the package boundary in
 * both directions: kolu reports which way it failed as a TAG and hands back the
 * failing party's own words where there were any, olai decides how to say it,
 * and core displays what comes out without composing a syllable of it. A kolu
 * that pre-worded these would make five English strings a contract between two
 * repositories — the exact coupling the division of labour exists to avoid — and
 * one that only said "it did not work" would put the debug log line on screen,
 * which is what the incident behind this feature was debugged around.
 *
 * They are also why there is no TABLE of failure sentences anywhere in the
 * plugin interface. Three of these five carry something that only exists at the
 * moment of failing — a deadline, a cause, the daemon's own refusal — so a
 * `Record<tag, string>` core looked a tag up in could hold at most two of them,
 * and the other three would be composed by whoever did the lookup.
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
 * The conversation is kolu's ({@link probeKolu}); the WORDS are ours, so this is
 * {@link whyOf} over kolu's verdict and nothing else. It stays exported, and the
 * deadline stays a parameter, for the reason it always was: a wedged server and
 * one that hung up reach the same closed pipe, and the only thing telling them
 * apart is which of these two sentences comes back — exactly the sort of thing
 * that rots into the wrong one with every other test still green. Exercising it
 * through {@link probe} would mean spending a real five seconds on every run
 * forever; a fixture that reads and never answers, given a tenth of one, says
 * the same thing.
 */
export const askOver = async (
  child: ChildProcess,
  deadlineMs: number,
): Promise<string | null> => {
  const verdict = await probeKolu(child, deadlineMs)
  return verdict._tag === "answered" ? null : whyOf(verdict)
}
