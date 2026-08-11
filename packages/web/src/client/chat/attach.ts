/**
 * A picture, from a Blob in this tab to a path on the server's disk.
 *
 * Three ways in — paste, drop, and the file picker a phone needs because it
 * has no Ctrl+V — and one way through: read the bytes, base64 them once, and
 * send them as a SEQUENCE of bounded `chat.attach` calls. The first creates
 * the file; each later one hands back the path it was given and appends. No
 * single frame scales with the picture, which is the whole reason the calls
 * are chunked at all (`@olai/surface`'s `attach.ts` owns that derivation).
 *
 * The chunks are SEQUENTIAL, not concurrent: the server appends to one growing
 * file, so two in flight would interleave their bytes and corrupt the picture
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
  attachmentRejection,
  chunkBase64,
  type OpFailure,
  UsageFailure,
} from "@olai/surface"
import { Effect } from "effect"

import { asFailure, type Call } from "./run.ts"

/** A picture that made it: where the server put it, what it is called, and the
 *  Blob this tab already had — which is what lets the tab that pasted it draw
 *  a thumbnail nobody else can (see {@link ./previews.ts}). */
export interface Attachment {
  readonly path: string
  readonly name: string
  readonly blob: Blob
}

/** The one verb this needs, so a test can pass its own. */
export type Attach = (chunk: {
  readonly name: string
  readonly data: string
  readonly appendTo?: string
}) => Call<{ readonly path: string }>

/**
 * Send `file` to the conversation, chunk by chunk.
 *
 * `chunkChars` exists so a test can drive the loop with a size it can read;
 * production passes nothing and gets the derived one.
 */
export const attaching = (
  file: File,
  attach: Attach,
  chunkChars?: number,
): Effect.Effect<Attachment, OpFailure> =>
  Effect.gen(function*() {
    const name = nameOf(file)
    const rejection = attachmentRejection(name, file.size)
    if (rejection !== null) {
      return yield* Effect.fail(new UsageFailure({ reason: rejection }))
    }

    const bytes = new Uint8Array(yield* Effect.promise(() => file.arrayBuffer()))
    const chunks = chunkBase64(base64Of(bytes), chunkChars)

    let path: string | undefined
    for (const data of chunks) {
      const answer = yield* toRefusal(
        attach(path === undefined ? { name, data } : { name, data, appendTo: path }),
      )
      path = answer.path
    }
    // `chunkBase64` always yields at least one piece, so the loop always ran.
    // Said out loud rather than defaulted: a `?? ""` here would put an empty
    // path in somebody's prompt.
    if (path === undefined) {
      return yield* Effect.fail(
        new UsageFailure({ reason: "nothing was written — that is a bug" }),
      )
    }
    return { path, name, blob: file }
  })

/**
 * What to call the file.
 *
 * A pasted screenshot usually arrives as a `File` with a name of its own
 * (`image.png`), and sometimes as one with nothing useful at all — so the type
 * is the fallback, because the EXTENSION is what the gate judges and what the
 * agent reads the picture's kind from.
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
  Effect.catch(call, (failure) => Effect.fail(asFailure(failure)))
