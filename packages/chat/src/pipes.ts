/**
 * A subprocess's pipes, as a stream of JSON-RPC messages.
 *
 * This package starts two kinds of subprocess and both speak line-delimited
 * JSON-RPC on stdio — the ACP agent ({@link ./agent.ts}) and, for the length of
 * one question, kolu's MCP server ({@link ./kolu.ts}). What they say to each
 * other is nothing alike; how a message gets on and off a pipe is identical, so
 * it is written once, here, and neither of them owns it.
 *
 * What the one axis behind this boundary is: how a Node child's pipes become
 * Web streams, and — {@link unstartable} — what to do about a child that never
 * ran to have any. Built by hand rather than with `stream.Web` helpers because
 * this runs under Bun's Node compatibility, and the two adapters differ in when
 * they close and how they surface a broken pipe — twenty lines with the
 * lifecycle written out beats a helper whose behaviour we would be assuming.
 * That is a reason to change this file and no reason to change either caller.
 */

import type { ChildProcess } from "node:child_process"

import { ndJsonStream, type Stream } from "@agentclientprotocol/sdk"
import { reasonOf } from "@olai/log"

/**
 * Why this child never ran — a promise that settles ONLY if it did not.
 *
 * A file on PATH with the executable bit is not a program: a bad interpreter
 * line, an architecture this host cannot run, a path that stopped existing
 * between being configured and being started. The exec fails AFTER `spawn` has
 * returned, so a `try` around the spawn never sees one — it arrives as an
 * `error` EVENT, and TWO things hang on somebody listening for it.
 *
 * The first is that nothing else is: an unhandled `error` on a child process is
 * an uncaught exception, and a subprocess neither of this package's callers
 * chose (a `kolu` on somebody's PATH, an `OLAI_ACP_AGENT` pointing at a moved
 * file) had a clean line to olai's stderr with a stack trace on it.
 *
 * The second is that this is the only reason worth reading. What follows an
 * exec failure is our own write to a stdin that was destroyed with it, so every
 * other door reports `Cannot call write after a stream was destroyed` — a
 * sentence about our end of a pipe, in place of the name of the file that would
 * not run. Both callers RACE this against their own conversation for exactly
 * that: whoever loses, the reason a person reads is the one about their
 * machine.
 *
 * It is here rather than in either caller because it is the same axis the rest
 * of this file is: what a Node child does to the process that spawned it, under
 * Bun. Both subprocesses in this package go through it, and a third would have
 * to be written to avoid it.
 */
export const unstartable = (child: ChildProcess): Promise<string> =>
  new Promise((resolve) => {
    child.once("error", (cause) => resolve(reasonOf(cause)))
  })

/** Messages in and out of a spawned child. Throws for a child spawned without
 *  pipes, which is a caller's mistake rather than a subprocess's. */
export const streamOver = (child: ChildProcess): Stream => {
  const stdout = child.stdout
  const stdin = child.stdin
  if (stdout === null || stdin === null) {
    throw new Error("the subprocess was spawned without pipes")
  }

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      // Both ends of the pipe close the same way, and a process exiting can
      // deliver `end` AND `error` — so closing twice has to be harmless.
      const close = () => {
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      stdout.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      stdout.on("end", close)
      stdout.on("error", close)
    },
  })

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      return new Promise<void>((resolve, reject) => {
        stdin.write(chunk, (cause) => (cause == null ? resolve() : reject(cause)))
      })
    },
    close() {
      stdin.end()
    },
    abort() {
      stdin.destroy()
    },
  })

  return ndJsonStream(writable, readable)
}
