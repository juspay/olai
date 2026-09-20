/**
 * The chunk loop, without a browser.
 *
 * Two properties, and both of them are the kind that look fine until the file
 * is big: the calls are SEQUENTIAL (the server appends to one growing file, so
 * two in flight interleave their bytes), and every call after the first hands
 * back the path it was given. A fake `attach` reassembles what it is sent, so
 * the assertion is the picture rather than the call count.
 */

import { expect, test } from "bun:test"
import { Effect, Result } from "effect"
import { FRAME_CHUNK_BASE64_CHARS, FRAME_PAYLOAD_BUDGET } from "@kolu/surface/frame-chunking"
import { UsageFailure } from "@olai/format"

import { type Attach, attaching, refusalFor } from "./attach.ts"

const picture = (name: string, bytes: Uint8Array, type = "image/png") =>
  new File([bytes as BlobPart], name, { type })

const body = new Uint8Array(Array.from({ length: 300 }, (_, at) => (at * 17) % 256))

/**
 * A server that keeps what it is told, in the order it was told — and RENAMES
 * what it stores, because the real one does: a name is sanitized and a
 * collision suffixed, so `shot.png` sent twice is `shot.png` and `shot-1.png`.
 * A fake that echoed the name back would be a fake that agrees with a client
 * keeping the name it sent, which is exactly the bug.
 */
const spy = () => {
  const files = new Map<string, Buffer>()
  const calls: Array<{ name: string; appendTo?: string | undefined }> = []
  const attach: Attach = (chunk) =>
    Effect.sync(() => {
      calls.push({ name: chunk.name, appendTo: chunk.appendTo })
      const name = `stored-${chunk.name}`
      const path = chunk.appendTo ?? `/tmp/olai-chat-x/${name}`
      files.set(
        path,
        Buffer.concat([files.get(path) ?? Buffer.alloc(0), Buffer.from(chunk.data, "base64")]),
      )
      return { path, name }
    })
  return { attach, calls, files }
}

test("a picture arrives whole, one chunk at a time", async () => {
  const server = spy()
  const outcome = await Effect.runPromise(
    Effect.result(attaching(picture("shot.png", body), server.attach, 8)),
  )

  expect(Result.isSuccess(outcome)).toBe(true)
  if (!Result.isSuccess(outcome)) return
  expect(server.calls.length).toBeGreaterThan(1)
  // The first call CREATES — no continuation — and every later one continues
  // the path it was answered with.
  expect(server.calls[0]?.appendTo).toBeUndefined()
  expect(server.calls.slice(1).every((call) => call.appendTo === outcome.success.path)).toBe(
    true,
  )
  expect(server.files.get(outcome.success.path)?.equals(Buffer.from(body))).toBe(true)
  // What it is CALLED is the server's answer, not the name that was sent. The
  // name is what the transcript row carries and what this tab's thumbnail is
  // keyed by, so a client that kept its own would draw one picture on another
  // picture's message the first time two pastes collided.
  expect(outcome.success.name).toBe("stored-shot.png")
})

test("what the server will not take is refused before a byte is encoded", async () => {
  const server = spy()
  const outcome = await Effect.runPromise(
    Effect.result(attaching(picture("logo.svg", body, "image/svg+xml"), server.attach, 8)),
  )

  expect(Result.isFailure(outcome)).toBe(true)
  // Nothing was sent: the pre-flight gate is the same function the server
  // refuses with, so there is no reason to spend the upload finding out.
  expect(server.calls).toEqual([])
})

test("a document goes up the same way a picture does", async () => {
  const server = spy()
  const outcome = await Effect.runPromise(
    Effect.result(attaching(picture("notes.txt", body, "text/plain"), server.attach, 8)),
  )

  // The chunk loop has never cared what kind of file it is carrying, and this
  // is the test that says so out loud now that it carries more than pictures:
  // same sequence, same continuation, same bytes at the end of it.
  expect(Result.isSuccess(outcome)).toBe(true)
  if (!Result.isSuccess(outcome)) return
  expect(server.calls.length).toBeGreaterThan(1)
  expect(server.files.get(outcome.success.path)?.equals(Buffer.from(body))).toBe(true)
})

test("a picture the clipboard did not name is named after its type", async () => {
  const server = spy()
  const outcome = await Effect.runPromise(
    Effect.result(attaching(picture("image", body, "image/webp"), server.attach, 8)),
  )

  expect(Result.isSuccess(outcome)).toBe(true)
  if (!Result.isSuccess(outcome)) return
  // ... and the server still has the last word on what it is called.
  expect(outcome.success.name).toBe("stored-pasted.webp")
})

test("a file the clipboard did not name is not called a picture unless it is one", async () => {
  // It used to be: every unnamed file became `pasted.png`, so an unnamed zip
  // passed the gate as a picture. Now it meets the gate under the
  // name it came with, and is refused before a byte is sent.
  for (const [name, type] of [["", "application/zip"], ["archive", "application/zip"]] as const) {
    const server = spy()
    const file = picture(name, body, type)
    expect(refusalFor(file)).toMatch(/cannot be attached/)
    const outcome = await Effect.runPromise(Effect.result(attaching(file, server.attach, 8)))
    expect(Result.isFailure(outcome)).toBe(true)
    expect(server.calls).toHaveLength(0)
  }
})


test("unnamed recordings get video names and preserve their bytes", async () => {
  for (const [type, extension] of [["video/mp4", "mp4"], ["video/quicktime", "mov"], ["video/webm", "webm"]]) {
    const server = spy()
    const file = picture("", body, type)
    expect(refusalFor(file)).toBeNull()
    const stored = await Effect.runPromise(attaching(file, server.attach, 8))
    expect(stored.name).toBe(`stored-recorded.${extension}`)
    expect(server.files.get(stored.path)?.equals(Buffer.from(body))).toBe(true)
  }
})

test("slices are bounded and read only after the previous append finishes", async () => {
  for (const size of [0, 1, 2, 6, 7, 8, 301]) {
    const original = new Uint8Array(Array.from({ length: size }, (_, at) => at % 256))
    const file = picture("clip.mp4", original, "video/mp4")
    file.arrayBuffer = () => { throw new Error("must not read the whole file") }
    const slice = file.slice.bind(file)
    let reads = 0
    let completed = 0
    file.slice = (start, end) => {
      expect(reads).toBe(completed)
      expect((end ?? 0) - (start ?? 0)).toBe(6)
      reads++
      return slice(start, end)
    }
    const server = spy()
    const attach: Attach = chunk => Effect.gen(function*() {
      yield* Effect.promise(() => new Promise(resolve => setTimeout(resolve, 1)))
      const stored = yield* server.attach(chunk)
      completed++
      return stored
    })
    const stored = await Effect.runPromise(attaching(file, attach, 8))
    expect(server.files.get(stored.path)?.equals(Buffer.from(original))).toBe(true)
    expect(completed).toBe(Math.max(1, Math.ceil(size / 6)))
  }
})


test("a refused append stops reading later slices", async () => {
  const file = picture("clip.mp4", body, "video/mp4")
  const slice = file.slice.bind(file)
  let reads = 0
  file.slice = (start, end) => { reads++; return slice(start, end) }
  const attach: Attach = chunk => chunk.appendTo === undefined
    ? Effect.succeed({ path: "/tmp/clip.mp4", name: "clip.mp4" })
    : Effect.fail(new UsageFailure({ reason: "the conversation changed" }))
  const result = await Effect.runPromise(Effect.result(attaching(file, attach, 8)))
  expect(Result.isFailure(result)).toBe(true)
  expect(reads).toBe(2)
})


test("the pinned frame chunk is aligned and fits the payload budget", () => {
  expect(FRAME_CHUNK_BASE64_CHARS).toBeGreaterThan(0)
  expect(FRAME_CHUNK_BASE64_CHARS % 4).toBe(0)
  expect(FRAME_CHUNK_BASE64_CHARS).toBeLessThanOrEqual(FRAME_PAYLOAD_BUDGET)
})

test("progress advances only after acknowledged chunks, including the short tail", async () => {
  const reported: number[] = []
  const server = spy()
  const attach: Attach = chunk => Effect.gen(function*() {
    expect(reported.at(-1)).toBe(server.calls.length * 6)
    return yield* server.attach(chunk)
  })
  await Effect.runPromise(attaching(picture("clip.mp4", body.slice(0, 14)), attach, 8, bytes => reported.push(bytes)))
  expect(reported).toEqual([0, 6, 12, 14])
})

test("progress never claims bytes from a refused append", async () => {
  const reported: number[] = []
  const attach: Attach = chunk => chunk.appendTo === undefined
    ? Effect.succeed({ path: "/tmp/clip.mp4", name: "clip.mp4" })
    : Effect.fail(new UsageFailure({ reason: "gone" }))
  await Effect.runPromise(Effect.result(attaching(picture("clip.mp4", body), attach, 8, bytes => reported.push(bytes))))
  expect(reported).toEqual([0, 6])
})

test("an empty file reports zero bytes and a preflight refusal reports nothing", async () => {
  const reported: number[] = []
  await Effect.runPromise(attaching(picture("empty.txt", new Uint8Array()), spy().attach, 8, bytes => reported.push(bytes)))
  expect(reported).toEqual([0, 0])
  reported.length = 0
  await Effect.runPromise(Effect.result(attaching(picture("no.zip", body), spy().attach, 8, bytes => reported.push(bytes))))
  expect(reported).toEqual([])
})
