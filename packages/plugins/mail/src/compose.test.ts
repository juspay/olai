import { expect, test } from "bun:test"
import { compose, recipient, validateDraft } from "./compose.ts"
import { MailRefusal } from "./wire.ts"

const base = { from: "you@gmail.com", to: ["ravi@example.com"], subject: "Hello", body: "Literal \\n and Unicode café\nnext line" }
test("plain text MIME preserves body bytes with 76-column base64 wrapping", () => {
  const message = compose({ ...base, cc: ["A Person <a@example.com>"], bcc: ["b@example.com"], body: base.body.repeat(100) })
  const [headers, body] = message.split("\r\n\r\n")
  expect(headers).toContain('Cc: "A Person" <a@example.com>')
  expect(headers).toContain("Bcc: b@example.com")
  expect(headers).toContain("Content-Type: text/plain; charset=utf-8")
  expect(headers).toContain("Content-Transfer-Encoding: base64")
  expect(body!.trim().split("\r\n").every(line => line.length <= 76)).toBe(true)
  expect(Buffer.from(body!, "base64").toString()).toBe(base.body.repeat(100))
})
test("Unicode subjects and display names use bounded RFC 2047 words without splitting code points", () => {
  const subject = "你好 café 😀".repeat(30)
  const raw = compose({ ...base, subject, to: ["Renée <r@example.com>"] })
  const words = raw.match(/=\?UTF-8\?B\?[^?]+\?=/g)!
  expect(words.every(word => word.length <= 75)).toBe(true)
  expect(words.map(word => Buffer.from(word.slice(10, -2), "base64").toString()).join("")).toBe("Renée" + subject)
})
test("header injection, malformed addresses and invalid bounds are refusals", () => {
  for (const args of [
    { subject: "hi\r\nBcc: x@y.com" }, { to: ["x@y.com\n"] }, { cc: ["no address"] }, { bcc: ["a..b@example.com"] },
    { to: ["a@-example.com"] }, { to: ["a@b@c"] }, { to: [] }, { body: "  " }, { body: "é".repeat(131073) },
    { cc: Array(50).fill("c@example.com") }, { draft: "--bad!" }, { thread: "oops" },
  ]) expect(() => compose({ ...base, ...args })).toThrow(MailRefusal)
  for (const field of ["from", "inReplyTo", "references"]) expect(() => compose({ ...base, [field]: "x\ry" })).toThrow(MailRefusal)
  expect(() => validateDraft({ body: "hello" })).toThrow("require To and Subject")
  expect(() => compose({ ...base, body: "a".repeat(256 * 1024), cc: Array(49).fill("c@example.com") })).not.toThrow()
  expect(recipient('"Doe, Jane" <jane@example.com>')).toBe('"Doe, Jane" <jane@example.com>')
})
