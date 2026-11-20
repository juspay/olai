import { FRAME_CHUNK_BASE64_CHARS, FRAME_PAYLOAD_BUDGET } from "@kolu/surface/frame-chunking"
import { attachmentRejection } from "@olai/surface"
import { type Attached, type AttachChunk } from "olai-plugin-chat/wire"
import { type OpFailure, UsageFailure } from "@olai/format"
import { Effect } from "effect"

import { asFailure, type Call } from "@olai/web/client/run.ts"

export type UploadProgress = (bytes: number) => void

export type Attach = (chunk: AttachChunk) => Call<Attached>

export const attaching = (
  file: File,
  attach: Attach,
  { chunkChars, progress }: { chunkChars?: number; progress?: UploadProgress } = {},
): Effect.Effect<Attached, OpFailure> =>
  Effect.gen(function*() {
    const name = nameOf(file)
    const rejection = attachmentRejection(name, file.size)
    if (rejection !== null) {
      return yield* Effect.fail(new UsageFailure({ reason: rejection }))
    }

    const chars = chunkChars ?? FRAME_CHUNK_BASE64_CHARS
    if (chunkChars !== undefined && (!Number.isInteger(chars) || chars <= 0 || chars % 4 !== 0 || chars > FRAME_PAYLOAD_BUDGET)) {
      return yield* Effect.die(new Error("invalid attachment chunk size"))
    }
    progress?.(0)
    // base64 pads only at the end of an encoding, so a chunk that is to be
    // concatenated with the next must cover a whole number of three-byte groups.
    const sliceBytes = chars / 4 * 3
    const read = (at: number) => Effect.promise(async () =>
      base64Of(new Uint8Array(await file.slice(at, at + sliceBytes).arrayBuffer()))
    )
    let stored = yield* toRefusal(attach({ name, data: yield* read(0) }))
    progress?.(Math.min(sliceBytes, file.size))
    for (let at = sliceBytes; at < file.size; at += sliceBytes) {
      stored = yield* toRefusal(attach({ name, data: yield* read(at), appendTo: stored.path }))
      progress?.(Math.min(at + sliceBytes, file.size))
    }
    return stored
  })

export const refusalFor = (file: File): string | null =>
  attachmentRejection(nameOf(file), file.size)

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

/** `String.fromCharCode` takes the bytes as an argument LIST, which the engine's
 *  stack bounds — so it is applied a slice at a time. */
const base64Of = (bytes: Uint8Array): string => {
  const STEP = 0x8000
  let binary = ""
  for (let at = 0; at < bytes.length; at += STEP) {
    binary += String.fromCharCode(...bytes.subarray(at, at + STEP))
  }
  return btoa(binary)
}

const toRefusal = <A>(call: Call<A>): Effect.Effect<A, OpFailure> =>
  Effect.mapError(call, asFailure)
