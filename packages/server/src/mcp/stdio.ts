/**
 * The MCP server, spoken over stdin and stdout — the transport for an agent
 * that is not ours.
 *
 * `@olai/ops` owns the tools and the JSON-RPC dispatch, and it owns no
 * transport at all; this is the second one, beside {@link ./route.ts}. The
 * split is not symmetry for its own sake — the two have different clients. The
 * route answers the session olai itself spawned, over the listener a browser is
 * already using. This answers a client that started US: a coding agent in a
 * terminal, which speaks MCP the way nearly every MCP client does, by launching
 * a command and talking to its pipes.
 *
 * **stdout is the protocol.** Nothing else may be written there — one stray
 * line and the client's parser is looking at a frame that is not a frame. That
 * is a property of this transport rather than of any one caller, so
 * {@link ./serve.ts} routes the whole program's logging to stderr rather than
 * asking every future writer to remember. What this file guarantees is the
 * other half: one message per line, and a message is `JSON.stringify`'s output,
 * which escapes every newline it could contain.
 *
 * **The framing is the specification's**: UTF-8, newline-delimited, no embedded
 * newlines. `Stream.splitLines` is what makes a message that arrived in three
 * chunks — or three messages that arrived in one — the same thing to the
 * dispatch behind it, which is exactly the class of bug a hand-rolled buffer
 * ships.
 */

import { Mcp } from "@olai/ops"
import { Effect, Stream } from "effect"

export interface Options {
  readonly server: Mcp.Server
  /** Bytes in. `process.stdin` is one of these; a test's async generator is
   *  another, which is what lets the framing be proven without a process. */
  readonly input: AsyncIterable<Uint8Array>
  /** One frame out, newline included. Sync because a pipe write is: Node
   *  queues what it cannot send yet, so there is nothing here to await. */
  readonly write: (frame: string) => void
}

/**
 * Answer every message the input carries, and return when it ends.
 *
 * The end of stdin is the end of the conversation — the client that launched
 * us has gone — so this completing is how the process learns to shut down,
 * rather than a signal it has to be sent.
 */
export const pump = (options: Options): Effect.Effect<void> =>
  Stream.fromAsyncIterable(options.input, (cause) => cause).pipe(
    Stream.decodeText(),
    Stream.splitLines,
    Stream.runForEach((line) => answer(options, line)),
    // Either pipe failing means the same one thing — the client is gone — and
    // there is nowhere to report it, because the only channels we have are its
    // own pipes. So it ends the conversation exactly as an EOF does, quietly,
    // rather than dying with a stack trace into whatever log the client keeps.
    // Defects are left alone: those are ours.
    Effect.catch(() => Effect.void),
  )

const answer = (options: Options, line: string) => {
  // Blank lines are framing, not messages. A client that writes `\r\n` or pads
  // between frames is not making an error worth a reply.
  if (line.trim() === "") return Effect.void

  let message: unknown
  try {
    message = JSON.parse(line)
  } catch {
    // The only frame a transport builds for itself, and it is the dispatch's
    // own: a line that will not parse never reaches `handle`, and the two
    // transports answer it identically because they are answering with the
    // same function.
    return frame(options, Mcp.parseError("the line is not JSON"))
  }

  return Effect.flatMap(options.server.handle(message), (reply) =>
    // `null` is a notification, and a notification is answered with silence.
    reply === null ? Effect.void : frame(options, reply))
}

const frame = (options: Options, message: Readonly<Record<string, unknown>>) =>
  Effect.try(() => options.write(`${JSON.stringify(message)}\n`))
