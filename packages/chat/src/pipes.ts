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
 * Web streams. Built by hand rather than with `stream.Web` helpers because this
 * runs under Bun's Node compatibility, and the two adapters differ in when they
 * close and how they surface a broken pipe — twenty lines with the lifecycle
 * written out beats a helper whose behaviour we would be assuming. That is a
 * reason to change this file and no reason to change either caller.
 */

import type { ChildProcess } from "node:child_process"

import { ndJsonStream, type Stream } from "@agentclientprotocol/sdk"

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
