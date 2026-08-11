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
 *     it. Anything else is a `null`, silently, because a host without kolu is
 *     the ordinary case rather than a fault.
 *   - **The path we probe is the path we hand over.** `kolu` is resolved on
 *     PATH here, once, and the session is given that absolute path — which is
 *     also what ACP's stdio shape asks for. Handing the bare word would leave
 *     the agent free to resolve it against a different PATH and spawn a
 *     different build than the one that answered.
 */

import { type ChildProcess, spawn } from "node:child_process"

import type { AnyMessage } from "@agentclientprotocol/sdk"
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
 * Kolu's MCP server if this host is running kolu, `null` if it is not.
 *
 * Asked once per conversation rather than once at boot ({@link ./agent.ts}), so
 * a padi started after olai is picked up by the next session instead of at the
 * next restart. It costs one process start and one round trip, on a path that
 * already spawns a subprocess and handshakes with it.
 */
export const detect: Effect.Effect<Server | null> = Effect.gen(function*() {
  const command = onPath(COMMAND)
  if (command === null) return null

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

  const answered = yield* Effect.promise(() => answers(command, env))
  if (!answered) {
    yield* Effect.logDebug("kolu is on PATH but no padi answered it").pipe(
      Effect.annotateLogs({ kolu: command }),
    )
    return null
  }
  yield* Effect.logInfo("kolu's terminals are on this session").pipe(
    Effect.annotateLogs({ kolu: command }),
  )
  return { name: COMMAND, command, args: ARGS, env }
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
 * Every way of failing arrives as the same `false`, and they arrive by one
 * door: the pipes closing ends the read below, and the deadline is a KILL
 * rather than a race, so a binary that is not kolu, a build that lost the verb,
 * a daemon that is not there and a wedge are one path with one answer.
 */
const answers = async (
  command: string,
  env: Readonly<Record<string, string>>,
): Promise<boolean> => {
  let child: ChildProcess
  try {
    child = spawn(command, [...ARGS], {
      stdio: ["pipe", "pipe", "ignore"],
      env: { ...process.env, ...env },
    })
  } catch {
    return false
  }

  const deadline = setTimeout(() => child.kill("SIGKILL"), PROBE_MS)
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
      if (next.done) return false
      const verdict = verdictOf(next.value)
      if (verdict !== null) return verdict
    }
  } catch {
    return false
  } finally {
    clearTimeout(deadline)
    child.kill("SIGKILL")
  }
}

/** What one message says about the read: `true` it answered, `false` it
 *  refused, `null` it was about something else. A refusal is what a kolu that
 *  reached no daemon sends, so it is a verdict rather than noise. */
const verdictOf = (message: AnyMessage): boolean | null => {
  const shape = message as { readonly id?: unknown; readonly result?: unknown }
  if (shape.id !== PROBE_ID) return null
  return shape.result !== undefined && shape.result !== null
}
