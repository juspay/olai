import { existsSync } from "node:fs"
import { basename } from "node:path"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import { idDigest, MAX_ATTACHMENT, openAttachments, safeFilename } from "./attachments.ts"
import { LONG_ATTACHMENT } from "./appliance/testlib/fixtures.ts"
import { harness } from "./tools.testlib.ts"

test("attachment names are safe and capped", () => {
  expect(safeFilename("../../a b💌.pdf")).toBe(".._.._a_b__.pdf")
  expect(safeFilename("x".repeat(200))).toHaveLength(120)
})
test("a Gmail attachment id becomes a short digest, so no path component is too long", () => {
  // NAME_MAX is 255 bytes on Linux, and a real id is longer than that on its
  // own — which is the write that failed before the digest.
  const component = `${idDigest("x".repeat(1000))}-${safeFilename("y".repeat(200))}`
  expect(Buffer.byteLength(component)).toBeLessThanOrEqual(255)
  expect(component).not.toContain("x")
  expect(idDigest(LONG_ATTACHMENT)).toHaveLength(16)
  expect(idDigest(LONG_ATTACHMENT)).toBe(idDigest(LONG_ATTACHMENT))
  expect(idDigest(`${LONG_ATTACHMENT}2`)).not.toBe(idDigest(LONG_ATTACHMENT))
})
test("an attachment whose id is 396 characters is saved, beside its shorter sibling", async () => {
  await Effect.runPromise(harness(h => Effect.gen(function*() {
    yield* h.call("thread", { thread: "a3" })
    const long = yield* h.call("attachment", { message: "a32", attachment: LONG_ATTACHMENT }) as Effect.Effect<any>
    expect(long).toMatchObject({ filename: "contract.png", bytes: 2048, mime: "image/png" })
    expect(Buffer.byteLength(basename(long.path))).toBeLessThanOrEqual(255)
    expect(basename(long.path)).toBe(`${idDigest(LONG_ATTACHMENT)}-contract.png`)
    expect(long.path).not.toContain(LONG_ATTACHMENT.slice(0, 40))
    expect(existsSync(long.path)).toBe(true)
    // The same attachment asked for twice is the same file; a different id on
    // the same message is a different one.
    const again = yield* h.call("attachment", { message: "a32", attachment: LONG_ATTACHMENT }) as Effect.Effect<any>
    expect(again.path).toBe(long.path)
    const short = yield* h.call("attachment", { message: "a32", attachment: "attachment_1" }) as Effect.Effect<any>
    expect(short.path).not.toBe(long.path)
    expect(existsSync(short.path)).toBe(true)
    const unknown = yield* Effect.result(h.call("attachment", { message: "a32", attachment: "attachment_9" }))
    expect(unknown).toMatchObject({ _tag: "Failure", failure: { reason: "read the mail thread first so this serve can check the attachment's size" } })
  })))
})
test("attachments live under the activation root and disappear on scope close", async () => {
  let saved = ""
  await Effect.runPromise(harness(h => Effect.gen(function*() {
    yield* h.call("thread", { thread: "a3" })
    const attachment = yield* h.call("attachment", { message: "a32", attachment: "attachment_1", filename: "../../invoice.pdf" }) as Effect.Effect<any>
    saved = attachment.path
    expect(saved.startsWith(h.root + "/olai-mail-attachments-")).toBe(true)
    expect(attachment.bytes).toBe(12288)
    expect(existsSync(saved)).toBe(true)
  })))
  expect(existsSync(saved)).toBe(false)
})
test("oversize is refused before download", async () => {
  let spawned = false
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const attachments = yield* openAttachments(undefined, () => { spawned = true; return Effect.succeed({}) })
    attachments.remember("a1", [{ id: "big", filename: "big", mime: "application/pdf", bytes: MAX_ATTACHMENT + 1 }])
    expect((yield* Effect.result(attachments.get("a1", "big")))._tag).toBe("Failure")
  })))
  expect(spawned).toBe(false)
})
