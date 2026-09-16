import { existsSync } from "node:fs"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import { MAX_ATTACHMENT, openAttachments, safeFilename } from "./attachments.ts"
import { harness } from "./tools.testlib.ts"

test("attachment names are safe and capped", () => {
  expect(safeFilename("../../a b💌.pdf")).toBe(".._.._a_b__.pdf")
  expect(safeFilename("x".repeat(200))).toHaveLength(120)
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
