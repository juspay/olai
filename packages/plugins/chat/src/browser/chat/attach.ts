/**
 * A file, from a Blob in this tab to a path on the server's disk.
 *
 * Paste, drop, the library picker, photo and video capture share one way
 * through: read and base64 one bounded slice at a time, sending a SEQUENCE of
 * bounded `chat.attach` calls. The first creates
 * the file; each later one hands back the path it was given and appends. No
 * single frame scales with the file, which is the whole reason the calls are
 * chunked at all — the size of one is the framework's, derived beside the cap
 * it has to fit under (`@kolu/surface/frame-chunking`).
 *
 * The chunks are SEQUENTIAL, not concurrent: the server appends to one growing
 * file, so two in flight would interleave their bytes and corrupt the file
 * silently. An Effect generator does that by construction — each `yield*`
 * waits for the previous chunk's answer.
 *
 * The gate runs FIRST, before a byte is encoded, and it is the same function
 * the server refuses with — so an oversized drop costs nothing and says exactly
 * what the server would have said.
 *
 * This module composes Effects and runs none: {@link ./state.ts} is where the
 * client runs one, and that is deliberately still true here.
 */

import { FRAME_CHUNK_BASE64_CHARS, FRAME_PAYLOAD_BUDGET } from "@kolu/surface/frame-chunking"
import { attachmentRejection } from "@olai/surface"
import { type Attached, type AttachChunk } from "olai-plugin-chat/wire"
import { type OpFailure, UsageFailure } from "@olai/format"
import { Effect } from "effect"

import { asFailure, type Call } from "@olai/web/client/run.ts"

/** The one verb this needs, so a test can pass its own. */
/** Bytes acknowledged by the server, starting at zero; never bytes merely read. */
export type UploadProgress = (bytes: number) => void

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
  progress?: UploadProgress,
): Effect.Effect<Attached, OpFailure> =>
  Effect.gen(function*() {
    const name = nameOf(file)
    const rejection = attachmentRejection(name, file.size)
    if (rejection !== null) {
      return yield* Effect.fail(new UsageFailure({ reason: rejection }))
    }

    const chars = chunkChars ?? FRAME_CHUNK_BASE64_CHARS
    // Production's framing contract is asserted in CI. A bad test seam is a
    // programmer error, not a refusal a person can fix by choosing a file.
    if (chunkChars !== undefined && (!Number.isInteger(chars) || chars <= 0 || chars % 4 !== 0 || chars > FRAME_PAYLOAD_BUDGET)) {
      return yield* Effect.die(new Error("invalid attachment chunk size"))
    }
    progress?.(0)
    // Each full slice is a multiple of three bytes: no padding separates
    // chunks, and only one slice is resident while its call is in flight.
    const sliceBytes = chars / 4 * 3
    const read = (at: number) => Effect.promise(async () =>
      base64Of(new Uint8Array(await file.slice(at, at + sliceBytes).arrayBuffer()))
    )
    // Even an empty file makes one create call. Every later read waits for
    // the previous append, retaining the server's path and upload lifetime.
    let stored = yield* toRefusal(attach({ name, data: yield* read(0) }))
    progress?.(Math.min(sliceBytes, file.size))
    for (let at = sliceBytes; at < file.size; at += sliceBytes) {
      stored = yield* toRefusal(attach({ name, data: yield* read(at), appendTo: stored.path }))
      progress?.(Math.min(at + sliceBytes, file.size))
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
 * agent reads the file's kind from. Pictures get a picture name, and camera
 * recordings get a video name (`recorded.mov` for QuickTime, for example).
 * Anything else keeps its name and meets the gate as that: calling an unnamed
 * zip `pasted.png` would let it pass as a picture it is not. The video fallback
 * belongs beside the picture's, rather than widening that exception to every
 * unnamed blob.
 */
const nameOf = (file: File): string => {
  if (file.name !== "" && file.name.includes(".")) return file.name
  if (file.type.startsWith("video/")) {
    const kind = file.type.split(";", 1)[0]
    return `recorded.${kind === "video/quicktime" ? "mov" : kind === "video/webm" ? "webm" : "mp4"}`
  }
  if (file.type !== "" && !file.type.startsWith("image/")) return file.name === "" ? "pasted" : file.name
  const kind = file.type.slice("image/".length)
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
