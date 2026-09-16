import { expect, test } from "bun:test"
import { Schema } from "effect"
import { THREADS } from "../appliance/testlib/fixtures.ts"
import { BODY_LIMIT, delta, fullOf, header, partsOf, rowOf, Thread } from "./threads.ts"

test("thread headers, labels, multipart HTML and attachments decode", () => {
  const threads = THREADS.map(t => Schema.decodeUnknownSync(Thread)(t))
  expect(header(threads[0]!.messages[0], "SUBJECT")).toBe("Q3 invoice")
  expect(rowOf(threads[0]!, ids => [...ids])).toMatchObject({ unread: true, messages: 1 })
  expect(fullOf("you@gmail.com", threads[1]!, ids => [...ids]).messages[0]).toMatchObject({ text: null, html: "<p>Meetup on October 2</p>" })
  expect(fullOf("you@gmail.com", threads[2]!, ids => [...ids]).messages[1]?.attachments).toEqual([{ id: "attachment_1", filename: "invoice.pdf", mime: "application/pdf", bytes: 12288 }])
  expect(delta(["INBOX", "UNREAD"], ["UNREAD", "waiting"])).toEqual({ added: ["waiting"], removed: ["INBOX"] })
})
test("64 KiB is exact, UTF-8 boundaries survive, each MIME type is independently capped", () => {
  const part = (text: string, mimeType = "text/plain") => ({ mimeType, body: { size: Buffer.byteLength(text), data: Buffer.from(text).toString("base64url") } })
  expect(partsOf(part("x".repeat(BODY_LIMIT))).truncated).toBe(false)
  const cut = partsOf({ mimeType: "multipart/alternative", parts: [part("x".repeat(BODY_LIMIT - 1) + "😀"), part("<p>Hello</p>", "text/html")] })
  expect(cut.truncated).toBe(true)
  expect(cut.text).not.toContain("�")
  expect(cut.text).toEndWith("[mail body truncated at 64 KiB]")
  expect(cut.html).toBe("<p>Hello</p>")
})
