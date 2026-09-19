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
test("unexpected composer exceptions remain defects when lifted into Effect", () => {
  const broken = { ...base, get body(): string { throw new TypeError("composer defect") } }
  const exit = Effect.runSyncExit(Effect.gen(function*() { return yield* Effect.fromResult(compose(broken)) }))
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) expect(Cause.hasDies(exit.cause)).toBe(true)
})
