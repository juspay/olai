/**
 * The chunking arithmetic, on its own.
 *
 * Every number here was derived rather than picked (see `./attach.ts`), and
 * the two properties the derivation rests on are the ones a future edit is
 * most likely to break by "rounding" the chunk size: it must be a multiple of
 * 3 raw, so the base64 pieces are a multiple of 4 characters, and the pieces
 * must decode independently and concatenate to the original bytes. A 4 MiB
 * chunk looks tidier and fails both.
 */

import { expect, test } from "bun:test"

import {
  attachmentRejection,
  base64DecodedLength,
  CHUNK_BASE64_CHARS,
  CHUNK_BYTES,
  chunkBase64,
  MAX_ATTACHMENT_BYTES,
} from "./attach.ts"

test("the chunk size divides base64's grouping exactly", () => {
  expect(CHUNK_BYTES % 3).toBe(0)
  expect(CHUNK_BASE64_CHARS % 4).toBe(0)
  // 3 MiB of bytes is exactly 4 MiB of base64 — the identity the size was
  // chosen for, and the reason a whole chunk fits the frame with ~4x to spare.
  expect(CHUNK_BASE64_CHARS).toBe(4 * 1024 * 1024)
  // Two independent numbers: the cap on a FILE is much larger than one frame,
  // which is the whole point of chunking. If these ever coincide again, the
  // failure is a closed socket rather than a refused upload.
  expect(MAX_ATTACHMENT_BYTES).toBeGreaterThan(CHUNK_BYTES)
})

test("the pieces decode independently and rejoin as the original bytes", () => {
  // 3 bytes per 4 base64 characters, so 9 characters per 12-byte chunk is a
  // size small enough to read and large enough to leave a short last piece.
  const bytes = Buffer.from(
    Array.from({ length: 50 }, (_, at) => (at * 37) % 256),
  )
  const pieces = chunkBase64(bytes.toString("base64"), 12)

  expect(pieces.length).toBeGreaterThan(1)
  // Each piece decodes ON ITS OWN — that is what the 4-character boundary
  // buys, and it is what lets the server append chunk by chunk.
  const rejoined = Buffer.concat(
    pieces.map((piece) => Buffer.from(piece, "base64")),
  )
  expect(rejoined.equals(bytes)).toBe(true)
})

test("an empty file is still one write", () => {
  expect(chunkBase64("", 12)).toEqual([""])
})

test("a chunk size off the 4-character grouping is a bug, not a slower upload", () => {
  expect(() => chunkBase64("AAAA", 6)).toThrow(/multiple of 4/)
})

test("a base64 string's decoded length is known without decoding it", () => {
  for (const size of [0, 1, 2, 3, 4, 5, 100]) {
    const data = Buffer.alloc(size, 7).toString("base64")
    expect(base64DecodedLength(data)).toBe(size)
  }
})

test("the gate names the two ways an attachment is refused", () => {
  expect(attachmentRejection("shot.png", 1024)).toBeNull()
  expect(attachmentRejection("shot.PNG", 1024)).toBeNull()

  // Not a picture — the format package's own allowlist, so `.svg` (a document
  // that can script) is not one either.
  expect(attachmentRejection("notes.txt", 10)).toMatch(/not a picture/)
  expect(attachmentRejection("logo.svg", 10)).toMatch(/not a picture/)

  expect(attachmentRejection("shot.png", MAX_ATTACHMENT_BYTES + 1)).toMatch(
    /over the 50 MB limit/,
  )
})
