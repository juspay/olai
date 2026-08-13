/**
 * Kolu's terminals, when this host is running one.
 *
 * [Kolu](https://kolu.dev) runs coding agents in terminals and serves them to
 * an agent over MCP (`kolu mcp`, stdio). If this host has one, the panel's
 * agent should be able to see those terminals without anybody configuring
 * anything — so this module answers one question, `Kolu.detect`, and
 * {@link ./agent.ts} adds what it answers to the servers a session is given.
 *
 * Three decisions are what this file is:
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
 *   - **The probe is the detection.** A `kolu` on PATH is not necessarily the
 *     host's kolu — a padi-spawned terminal prepends its own bundled copy, and
 *     one of those was an older build reporting the same version string while
 *     missing most of the verbs (juspay/kolu#2146, fixed by #2147; the lesson
 *     survives the fix, because the wrong build still SPAWNS). So nothing here
 *     trusts a path, a version string or an exit code: the executable is
 *     started, handshaken with, and asked to read a resource that only the
 *     daemon can answer. An answer is the evidence, and it is evidence of both
 *     halves at once — this binary speaks the protocol, AND a padi is behind
 *     it. Anything else is a no — because a host without kolu is the ordinary
 *     case rather than a fault — but a no that SAYS WHY ({@link Detected}). It
 *     used to be one silent `false` for all four ways of failing, with the
 *     reason destroyed by a `catch` before anything could report it.
 *   - **The path we probe is the path we hand over.** `kolu` is resolved on
 *     PATH here, once, and the session is given that absolute path — which is
 *     also what ACP's stdio shape asks for. Handing the bare word would leave
 *     the agent free to resolve it against a different PATH and spawn a
 *     different build than the one that answered.
 */

import { type ChildProcess, spawn } from "node:child_process"

import type { AnyMessage } from "@agentclientprotocol/sdk"
import { reasonOf } from "@olai/log"
import type { MissingServer } from "@olai/surface"
import { Effect } from "effect"

import { streamOver } from "./pipes.ts"

/** The executable, its verb, and the variable that says which padi. All three
 *  are kolu's own `.mcp.json` entry, unchanged. */
const COMMAND = "kolu"
const ARGS = ["mcp"] as const
const SOCKET = "PADI_SOCKET"

/** What the probe reads. A padi's identity — the commit it is running, when it
 *  started — is the daemon's own, so an answer cannot be produced by a kolu
 *  that reached no daemon: that one fails the read with `padi transport down`.
 *  Read-only, and one round trip. */
const IDENTITY = "surface://cells/identity"

/** How long the probe gets. Generous for a process start and one round trip
 *  over a unix socket — and it is spent BEFORE the session opens, so a host
 *  whose kolu wedges pays this much per conversation and gets no kolu in it.
 *  What makes five seconds affordable is where they are spent: booting the
 *  agent is a background job with the panel already drawn (`chat.ts`'s
 *  `start`), and a `session/load` next to it is allowed two minutes. */
const PROBE_MS = 5_000

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
  /** No `kolu` on PATH at all — the ordinary case, and not a fault. */
  | { readonly _tag: "none" }
  /** A `kolu` on PATH that did not answer, and what happened. */
  | { readonly _tag: "silent"; readonly kolu: string; readonly why: string }

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
 * `@olai/surface`'s own shape rather than one of ours, because there is nothing
 * between this and the wire that would translate it — and a second spelling of
 * "a server, where it was, and why not" is a second thing to keep in step.
 */
export const missingFrom = (found: Detected): MissingServer | null =>
  found._tag === "silent"
    ? { name: COMMAND, where: found.kolu, why: found.why }
    : null

/**
 * Kolu's MCP server if this host is running kolu, and why not if it is not.
 *
 * Asked once per conversation rather than once at boot ({@link ./agent.ts}), so
 * a padi started after olai is picked up by the next session instead of at the
 * next restart. It costs one process start and one round trip, on a path that
 * already spawns a subprocess and handshakes with it.
 */
export const detect: Effect.Effect<Detected> = Effect.gen(function*() {
  const command = onPath(COMMAND)
  if (command === null) return { _tag: "none" }

  // Forwarded rather than merely inherited, because the ACP agent is what
  // spawns this and its environment is its own business — the variable travels
  // as part of the entry, exactly as kolu's `.mcp.json` declares it. Unset is
  // not a failure: kolu resolves this host's padi by itself, and says so when
  // there is more than one to choose from (which the probe then reports as
  // "no", correctly — that host is ambiguous, not ours to guess about).
  const socket = process.env[SOCKET]
  const env: Readonly<Record<string, string>> = socket === undefined || socket === ""
    ? {}
    : { [SOCKET]: socket }

  const why = yield* Effect.promise(() => whyNotAnswered(command, env))
  if (why !== null) {
    // The reason is on the line now as well as on the value. It used to say
    // only that "no padi answered", which is the one thing every way of
    // failing had in common and the one thing that never helped.
    yield* Effect.logDebug("kolu is on PATH but did not answer").pipe(
      Effect.annotateLogs({ kolu: command, why }),
    )
    return { _tag: "silent", kolu: command, why }
  }
  yield* Effect.logInfo("kolu's terminals are on this session").pipe(
    Effect.annotateLogs({ kolu: command }),
  )
  return { _tag: "kolu", server: { name: COMMAND, command, args: ARGS, env } }
})

/** The executable by that name on PATH, or `null`. The PATH is passed rather
 *  than left to the runtime's own copy, which is the one this process STARTED
 *  with — the live one is what a spawn would resolve against, and the point of
 *  this whole file is to probe the file that would actually run. */
const onPath = (name: string): string | null => Bun.which(name, { PATH: process.env["PATH"] ?? "" })

/** The id the read is sent under, so the answer to it is the only message that
 *  decides anything. Exported for `kolu.test.ts`, whose fixtures answer under
 *  it — an answer carrying a different id is not an answer, and a test that
 *  spelled the number itself could go on passing while this one moved. */
export const PROBE_ID = 2

/** The whole conversation, sent at once. A server that reads its input in order
 *  answers in order, and one that cannot is one whose answer we would not
 *  want. */
const CONVERSATION: ReadonlyArray<AnyMessage> = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "olai", version: "0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: PROBE_ID, method: "resources/read", params: { uri: IDENTITY } },
]

/**
 * Start it, say all that, and wait for the one answer that decides it — then
 * kill it either way. This process is a PROBE and never a client: the session
 * gets its own, spawned by the agent.
 *
 * `null` means it answered; anything else is the sentence saying which way it
 * did not, which is the difference between "kolu is not running here" (fine,
 * and common) and "the kolu on your PATH is a build that cannot do this" (worth
 * knowing, and — until `mcp-fail-visible` drew it — invisible).
 *
 * Almost every way of failing arrives by one door: the pipes closing ends the
 * read, and the deadline is a KILL rather than a race, so a wedged server and a
 * server that hung up are the same `done` with a flag to tell them apart. The
 * ONE that cannot come that way is a file that would not exec, which is a
 * second door and says below why it has to be.
 */
const whyNotAnswered = async (
  command: string,
  env: Readonly<Record<string, string>>,
): Promise<string | null> => {
  let child: ChildProcess
  try {
    child = spawn(command, [...ARGS], {
      stdio: ["pipe", "pipe", "ignore"],
      env: { ...process.env, ...env },
    })
  } catch (cause) {
    return couldNotStart(cause)
  }

  // A file on PATH with the executable bit is not a program, and this is where
  // that stops being our problem: a bad interpreter line, a text file somebody
  // chmod'd, an architecture this host cannot run. The exec fails AFTER `spawn`
  // has returned, so the `catch` above never sees one — it arrives as an
  // `error` EVENT, and TWO things hang on somebody listening for it.
  //
  // The first is that nothing else is listening: an unhandled `error` on a
  // child process is an uncaught exception, so olai's own server was one
  // unrunnable `kolu` on a PATH away from going down. The second is that this
  // is the only reason worth reading. Every other door reports the BROKEN PIPE
  // that followed — "talking to it failed: Cannot call write after a stream was
  // destroyed", which is a fact about our own write and says nothing about the
  // file — so racing it is not belt and braces, it is the difference between
  // naming the fault and describing our end of it.
  const unstartable = new Promise<string>((resolve) => {
    child.once("error", (cause) => resolve(couldNotStart(cause)))
  })
  return await Promise.race([unstartable, askOver(child)])
}

/** Say all of it, and wait for the one answer that decides it — then kill the
 *  process either way ({@link whyNotAnswered} is what starts it, and says why
 *  the start is a question of its own). */
const askOver = async (child: ChildProcess): Promise<string | null> => {
  /** Whether the deadline is what ended this, so the closed pipe below is read
   *  as the timeout it is rather than as an agent that hung up. */
  let expired = false
  const deadline = setTimeout(() => {
    expired = true
    child.kill("SIGKILL")
  }, PROBE_MS)
  try {
    const stream = streamOver(child)
    const writer = stream.writable.getWriter()
    for (const message of CONVERSATION) await writer.write(message)
    // stdin stays OPEN: a server told its client has gone is entitled to leave
    // before it has finished answering, and the kill below is what ends this
    // one.
    const reader = stream.readable.getReader()
    while (true) {
      const next = await reader.read()
      if (next.done) {
        return expired
          ? `it did not answer within ${PROBE_MS / 1000}s`
          : "it closed the connection without answering"
      }
      if (!answersTheProbe(next.value)) continue
      return refusalIn(next.value)
    }
  } catch (cause) {
    return `talking to it failed: ${reasonOf(cause)}`
  } finally {
    clearTimeout(deadline)
    child.kill("SIGKILL")
  }
}

/** The one sentence for a file that would not run, wherever the refusal reached
 *  us — Bun raises it on an event and Node may throw it, and a reader has no
 *  business being told which. */
const couldNotStart = (cause: unknown): string =>
  `it could not be started: ${reasonOf(cause)}`

/** Two questions, and they were one three-valued answer: this one is "is this
 *  message ours at all", which is about the ENVELOPE and true of a refusal
 *  exactly as much as of a success. */
const answersTheProbe = (message: AnyMessage): boolean =>
  (message as { readonly id?: unknown }).id === PROBE_ID

/** ... and this one is what our answer SAYS: `null` it answered, a sentence it
 *  refused. A refusal is what a kolu that reached no daemon sends, so it is a
 *  verdict rather than noise — and it is the one whose reason a reader most
 *  wants, since a kolu answering this way is installed, running, and running
 *  against nothing. */
const refusalIn = (message: AnyMessage): string | null => {
  const shape = message as {
    readonly result?: unknown
    readonly error?: { readonly message?: unknown }
  }
  if (shape.result !== undefined && shape.result !== null) return null
  const said = shape.error?.message
  return typeof said === "string" && said !== ""
    ? `it refused to read the daemon's identity: ${said}`
    : "it refused to read the daemon's identity, so no padi is behind it"
}
