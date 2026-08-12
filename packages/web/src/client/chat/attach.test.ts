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

import { type Attach, attaching } from "./attach.ts"

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
