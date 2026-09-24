import { expect, test } from "bun:test"
import { Result, Effect, Exit, Cause } from "effect"
import { addressList, compose, recipient, validateDraft } from "./compose.ts"
import { MailRefusal } from "./wire.ts"

const base = { from: "you@gmail.com", to: ["ravi@example.com"], subject: "Hello", body: "Literal \\n and Unicode café\nnext line" }
test("plain text MIME preserves body bytes with 76-column base64 wrapping", () => {
  const message = Result.getOrThrow(compose({ ...base, cc: ["A Person <a@example.com>"], bcc: ["b@example.com"], body: base.body.repeat(100) }))
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
  const raw = Result.getOrThrow(compose({ ...base, subject, to: ["Renée <r@example.com>"] }))
  const words = raw.match(/=\?UTF-8\?B\?[^?]+\?=/g)!
  expect(words.every(word => word.length <= 75)).toBe(true)
  expect(words.map(word => Buffer.from(word.slice(10, -2), "base64").toString()).join("")).toBe("Renée" + subject)
})
test("header injection, malformed addresses and invalid bounds are refusals", () => {
  for (const args of [
    { subject: "hi\r\nBcc: x@y.com" }, { to: ["x@y.com\n"] }, { cc: ["no address"] }, { bcc: ["a..b@example.com"] },
    { to: ["a@-example.com"] }, { to: ["a@b@c"] }, { to: [] }, { body: "  " }, { body: "é".repeat(131073) },
    { cc: Array(50).fill("c@example.com") }, { draft: "--bad!" }, { thread: "oops" },
  ]) expect(compose({ ...base, ...args })).toMatchObject({ _tag: "Failure", failure: expect.any(MailRefusal) })
  for (const field of ["from", "inReplyTo", "references"]) expect(compose({ ...base, [field]: "x\ry" })).toMatchObject({ _tag: "Failure", failure: expect.any(MailRefusal) })
  expect(validateDraft({ body: "hello" })).toMatchObject({ _tag: "Failure", failure: { reason: "new mail drafts require To and Subject" } })
  expect(compose({ ...base, body: "a".repeat(256 * 1024), cc: Array(49).fill("c@example.com") })._tag).toBe("Success")
  expect(Result.getOrThrow(recipient('"Doe, Jane" <jane@example.com>'))).toBe('"Doe, Jane" <jane@example.com>')
})

test("default address lists handle quoted commas, escaped quotes and encoded display names", () => {
  expect(Result.getOrThrow(addressList("<bare@example.com>"))).toEqual(["bare@example.com"])
  expect(Result.getOrThrow(addressList('"Doe, Jane" <jane@example.com>, =?UTF-8?B?UmVuw6ll?= <r@example.com>'))).toEqual(["jane@example.com", "r@example.com"])
  expect(Result.getOrThrow(addressList('"Doe, \\"Jane\\"" <jane@example.com>, b@example.com'))).toEqual(["jane@example.com", "b@example.com"])
  for (const value of ['a@example.com,', '"unclosed <a@example.com>', 'a@example.com\r\nBcc: b@example.com', 'a@example.com,,b@example.com']) expect(addressList(value)._tag).toBe("Failure")
})
test("References folds each message id and ASCII subjects stay readable", () => {
  const references = Array.from({ length: 40 }, (_, i) => `<message-${i}-${"x".repeat(30)}@example.com>`).join(" ")
  const subject = "An ASCII subject with plenty of words ".repeat(8).trim()
  const raw = Result.getOrThrow(compose({ ...base, subject, references }))
  const headers = raw.split("\r\n\r\n")[0]!
  expect(headers.split("\r\n").every(line => Buffer.byteLength(line) <= 78)).toBe(true)
  expect(headers).not.toContain("=?UTF-8?")
  expect(headers.replace(/\r\n /g, " ")).toContain(`Subject: ${subject}`)
  expect(headers.replace(/\r\n /g, " ")).toContain(`References: ${references}`)
})
const enclosure = (filename: string, type: string, data: Buffer | string) => ({ filename, type, data: typeof data === "string" ? Buffer.from(data) : data })
const partsOf = (message: string) => {
  const boundary = /boundary="([^"]+)"/.exec(message.split("\r\n\r\n")[0]!)![1]!
  const [, ...parts] = message.split(`--${boundary}`)
  return { boundary, parts }
}
test("a draft with no attachments is the single text part it has always been", () => {
  const message = Result.getOrThrow(compose({ ...base, body: "Count me in" }))
  expect(message).toBe("From: you@gmail.com\r\nTo: ravi@example.com\r\nSubject: Hello\r\nMIME-Version: 1.0\r\n"
    + "Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\nQ291bnQgbWUgaW4=\r\n")
  expect(Result.getOrThrow(compose({ ...base, body: "Count me in" }, []))).toBe(message)
  expect(Result.getOrThrow(compose({ ...base, body: "Count me in", attachments: [] }))).toBe(message)
})
test("attached files become multipart parts whose bytes survive base64", () => {
  const bytes = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 256))
  const message = Result.getOrThrow(compose({ ...base, body: "See attached" }, [enclosure("invoice.pdf", "application/pdf", bytes), enclosure("notes.txt", "text/plain", "two lines\nof notes")]))
  const [head, ...rest] = message.split("\r\n\r\n")
  expect(head).toContain("MIME-Version: 1.0")
  expect(head).not.toContain("Content-Transfer-Encoding")
  const { boundary, parts } = partsOf(message)
  expect(boundary.startsWith("=_olai_")).toBe(true)
  expect(boundary).toContain("=")
  expect(parts).toHaveLength(4)
  expect(parts.at(-1)).toBe("--\r\n")
  expect(parts[0]).toContain("Content-Type: text/plain; charset=utf-8")
  expect(Buffer.from(parts[0]!.split("\r\n\r\n")[1]!, "base64").toString()).toBe("See attached")
  expect(parts[1]).toContain("Content-Type: application/pdf;\r\n name=\"invoice.pdf\"")
  expect(parts[1]).toContain("Content-Disposition: attachment;\r\n filename=\"invoice.pdf\"")
  expect(parts[1]).toContain("Content-Transfer-Encoding: base64")
  expect(Buffer.from(parts[1]!.split("\r\n\r\n")[1]!, "base64").equals(bytes)).toBe(true)
  expect(Buffer.from(parts[2]!.split("\r\n\r\n")[1]!, "base64").toString()).toBe("two lines\nof notes")
  // Every line ends CRLF, and no base64 line is wider than MIME's 76 columns.
  expect(message.replace(/\r\n/g, "")).not.toContain("\n")
  expect(rest.join("\r\n\r\n").split("\r\n").every(line => line.length <= 76)).toBe(true)
  expect(message.endsWith(`\r\n--${boundary}--\r\n`)).toBe(true)
})
test("an empty file is still a part, and one attachment needs no second boundary", () => {
  const message = Result.getOrThrow(compose(base, [enclosure("empty.txt", "text/plain", "")]))
  const { parts } = partsOf(message)
  expect(parts).toHaveLength(3)
  expect(parts[1]!.endsWith("\r\n\r\n")).toBe(true)
})
test("non-ASCII and quoted filenames take RFC 2231 on the disposition and RFC 2047 on the type", () => {
  const message = Result.getOrThrow(compose(base, [enclosure("Café ☕.txt", "text/plain", "notes"), enclosure('say "hi".txt', "text/plain", "notes")]))
  expect(message).toContain("filename*=UTF-8''Caf%C3%A9%20%E2%98%95.txt")
  expect(message).toContain('name="=?UTF-8?B?Q2Fmw6kg4piVLnR4dA==?="')
  expect(message).toContain("filename*=UTF-8''say%20%22hi%22.txt")
  expect(message).not.toContain('filename="Café')
  const words = message.match(/=\?UTF-8\?B\?[^?]+\?=/g)!
  expect(words.every(word => word.length <= 75)).toBe(true)
})
test("attachment filenames and content types are refused the way headers are", () => {
  for (const one of [enclosure("in\r\nvoice.pdf", "application/pdf", "x"), enclosure("in\nvoice.pdf", "application/pdf", "x"), enclosure("bell\x07.pdf", "application/pdf", "x"), enclosure("   ", "application/pdf", "x")]) {
    expect(compose(base, [one])).toMatchObject({ _tag: "Failure", failure: expect.any(MailRefusal) })
  }
  for (const type of ["application", "application/pdf; charset=utf-8", "application/", "text/pl ain", "text/plain\r\nX: y", ""]) {
    expect(compose(base, [enclosure("invoice.pdf", type, "x")])).toMatchObject({ _tag: "Failure", failure: expect.any(MailRefusal) })
  }
})
test("attachment arguments are validated with the rest of the draft, before anything is read", () => {
  const attachments = [{ path: "relative/invoice.pdf" }]
  expect(compose({ ...base, attachments })).toMatchObject({ _tag: "Failure", failure: { reason: "mail attachments need an absolute path: relative/invoice.pdf" } })
  expect(validateDraft({ ...base, attachments })).toMatchObject({ _tag: "Failure", failure: expect.any(MailRefusal) })
  expect(validateDraft({ ...base, attachments: [{ path: "/tmp/a.pdf" }, { path: "/other/a.pdf" }] })).toMatchObject({ _tag: "Failure", failure: { reason: "two mail attachments would arrive as a.pdf; give one of them its own filename" } })
  expect(validateDraft({ ...base, attachments: [{ path: "/tmp/a.pdf" }, { path: "/other/a.pdf", filename: "b.pdf" }] })._tag).toBe("Success")
})
test("unexpected composer exceptions remain defects when lifted into Effect", () => {
  const broken = { ...base, get body(): string { throw new TypeError("composer defect") } }
  const exit = Effect.runSyncExit(Effect.gen(function*() { return yield* Effect.fromResult(compose(broken)) }))
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) expect(Cause.hasDies(exit.cause)).toBe(true)
})
