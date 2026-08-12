/**
 * A file, from a Blob in this tab to a path on the server's disk.
 *
 * Three ways in — paste, drop, and the file picker a phone needs because it
 * has no Ctrl+V — and one way through: read the bytes, base64 them once, and
 * send them as a SEQUENCE of bounded `chat.attach` calls. The first creates
 * the file; each later one hands back the path it was given and appends. No
 * single frame scales with the file, which is the whole reason the calls
 * are chunked at all (`@olai/surface`'s `attach.ts` owns that derivation).
 *
 * The chunks are SEQUENTIAL, not concurrent: the server appends to one growing
 * file, so two in flight would interleave their bytes and corrupt the file
 * silently. An Effect generator does that by construction — each `yield*`
 * waits for the previous chunk's answer.
 *
 * The gate runs FIRST, before a byte is encoded, and it is the same function
 * the server refuses with — so a 60 MB drop costs nothing and says exactly
 * what the server would have said.
 *
 * This module composes Effects and runs none: {@link ./state.ts} is where the
 * client runs one, and that is deliberately still true here.
 */

import {
  type Attached,
  type AttachChunk,
  attachmentRejection,
  chunkBase64,
  type OpFailure,
  UsageFailure,
} from "@olai/surface"
import { Effect } from "effect"

import { asFailure, type Call } from "../run.ts"

/** The one verb this needs, so a test can pass its own. */
export type Attach = (chunk: AttachChunk) => Call<Attached>

/**
 * Send `file` to the conversation, chunk by chunk, and answer with where it
 * landed and what the SERVER calls it there.
 *
 * That name is the server's answer and never the one we sent: sanitising and
 * the collision suffix both happen down there — `shot.png` pasted twice is
 * `shot.png` and `shot-1.png` — and it is the answer the transcript row
 * carries. Keeping the sent name would be a second answer to "what is this
 * called", and the first thing that costs is a thumbnail drawn on the wrong
 * row.
 *
 * `chunkChars` exists so a test can drive the loop with a size it can read;
 * production passes nothing and gets the derived one.
 */
export const attaching = (
  file: File,
  attach: Attach,
  chunkChars?: number,
): Effect.Effect<Attached, OpFailure> =>
  Effect.gen(function*() {
    const name = nameOf(file)
    const rejection = attachmentRejection(name, file.size)
    if (rejection !== null) {
      return yield* Effect.fail(new UsageFailure({ reason: rejection }))
    }

    // Encoded in one pass and let go of: the raw bytes are dead the moment the
    // base64 exists, and a 50 MB paste holding both while it makes seventeen
    // round trips is 50 MB nobody is reading.
    const [creating, ...continuing] = chunkBase64(
      base64Of(new Uint8Array(yield* Effect.promise(() => file.arrayBuffer()))),
      chunkChars,
    )

    // The protocol, as the shape of the code: the first chunk creates the
    // file, every later one continues the path it was answered with. Sequential
    // by construction, because the server appends to one growing file and two
    // chunks in flight would interleave their bytes.
    let stored = yield* toRefusal(attach({ name, data: creating }))
    for (const data of continuing) {
      stored = yield* toRefusal(attach({ name, data, appendTo: stored.path }))
    }
    return stored
  })

/**
 * Why this file would be refused, or `null` — the gate, asked about the name
 * this module would SEND rather than the one the file arrived with.
 *
 * Exported because the gate is also asked one step EARLIER ({@link
 * ./holding.ts} sorts a whole drop before any of it is uploaded), and the two
 * askings have to agree about what the file is called: judging `file.name`
 * would refuse exactly the unnamed clipboard picture {@link nameOf} exists to
 * name. Handing out the answer rather than the name is what makes that
 * mechanical instead of a rule the other module has to remember.
 */
export const refusalFor = (file: File): string | null =>
  attachmentRejection(nameOf(file), file.size)

/**
 * What to call the file.
 *
 * A pasted screenshot usually arrives as a `File` with a name of its own
 * (`image.png`), and sometimes as one with nothing useful at all — so the type
 * is the fallback, because the EXTENSION is what the gate judges and what the
 * agent reads the file's kind from.
 */
const nameOf = (file: File): string => {
  if (file.name !== "" && file.name.includes(".")) return file.name
  const kind = file.type.startsWith("image/") ? file.type.slice("image/".length) : ""
  return `pasted.${kind === "" ? "png" : kind.replace(/[^a-z0-9]/gi, "")}`
}

/** Bytes as base64, in slices small enough that `String.fromCharCode` is not
 *  handed an argument list the stack cannot take. */
const base64Of = (bytes: Uint8Array): string => {
  const STEP = 0x8000
  let binary = ""
  for (let at = 0; at < bytes.length; at += STEP) {
    binary += String.fromCharCode(...bytes.subarray(at, at + STEP))
  }
  return btoa(binary)
}

/** A call's failures are `unknown` on the wire and an `OpFailure` in the panel.
 *  {@link ./run.ts} owns that translation for the verbs it RUNS; this is the
 *  same one, for calls composed into the loop above. */
const toRefusal = <A>(call: Call<A>): Effect.Effect<A, OpFailure> =>
  Effect.mapError(call, asFailure)
