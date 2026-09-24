/** Plain-text and multipart draft composition only. No capabilities, no live
 *  mailbox state, and no file reading: attachments arrive already read
 *  (`./enclosures.ts`), and what a caller ASKED to attach — paths this
 *  composer never opens — is that module's business, not this one's. */
import { randomUUID } from "node:crypto"
import { Result } from "effect"
import { contentType, CONTROL, type Enclosure, type EnclosureArgs } from "./enclosures.ts"
import { MailRefusal } from "./wire.ts"

export interface DraftArgs {
  readonly to?: ReadonlyArray<string>
  readonly cc?: ReadonlyArray<string>
  readonly bcc?: ReadonlyArray<string>
  readonly subject?: string
  readonly body: string
  readonly thread?: string
  readonly draft?: string
  readonly attachments?: ReadonlyArray<EnclosureArgs>
}
const refuse = (reason: string) => Result.fail(new MailRefusal({ reason }))
export const headerValue = (value: string): Result.Result<string, MailRefusal> => {
  if (/[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) return refuse("mail headers cannot contain CR, LF or control characters")
  return Result.succeed(value)
}
// Each encoded word fits RFC 2047's 75-character limit, split on code points.
const encodedWords = (value: string): string => {
  const chunks: string[] = []
  let chunk = ""
  for (const char of value) {
    if (Buffer.byteLength(chunk + char) > 42) { chunks.push(chunk); chunk = "" }
    chunk += char
  }
  if (chunk) chunks.push(chunk)
  return chunks.map(part => `=?UTF-8?B?${Buffer.from(part).toString("base64")}?=`).join("\r\n ")
}
/** ...and the shortcut every header but one wants: a short ASCII value is
 *  already its own best spelling. A parameter that will sit inside a quoted
 *  string cannot take the shortcut — an unescaped `"` would end the string —
 *  so {@link enclosurePart} asks for the words themselves. */
const encoded = (value: string): string =>
  !/[^\x20-\x7e]/.test(value) && value.length <= 70 ? value : encodedWords(value)
// Fold ASCII subjects at existing whitespace, retaining their raw readability.
// An unbreakable long word still uses bounded encoded words.
const subjectHeader = (value: string): string => {
  if (/[^\x20-\x7e]/.test(value) || value.split(/\s+/).some(word => word.length > 69)) return encoded(value)
  let column = 9
  return value.split(/( +)/).map((part, i, parts) => {
    if (/^ +$/.test(part) && column + part.length + (parts[i + 1]?.length ?? 0) > 78) {
      column = part.length
      return `\r\n${part}`
    }
    column += part.length
    return part
  }).join("")
}
const mailbox = (value: string) => Result.gen(function*() {
  yield* headerValue(value)
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(value.trim())
  const address = (match?.[2] ?? value).trim()
  const [local, domain, extra] = address.split("@")
  if (extra !== undefined || !local || !domain || local.length > 64 || address.length > 254
    || !/^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*$/.test(local)
    || !domain.split(".").every(label => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) return yield* refuse(`malformed mail address: ${value}`)
  let name = match?.[1]?.trim()
  if (name?.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1).replace(/\\(["\\])/g, "$1")
  if (name && /[<>]/.test(name)) return yield* refuse(`malformed mail address: ${value}`)
  return { address, name }
})
export const recipient = (value: string) => Result.gen(function*() {
  const { address, name } = yield* mailbox(value)
  if (!name) return address
  const display = /[^\x20-\x7e]/.test(name) || name.length > 70 ? encoded(name) : `"${name.replace(/["\\]/g, "\\$&")}"`
  return `${display} <${address}>`
})
/** Mailbox header lists split only at commas outside quotes/angle brackets.
 * Defaults retain addr-specs, so RFC 2047 display names cannot become quoted
 * encoded words. Explicit tool recipients still use recipient's display names. */
export const addressList = (value: string) => Result.gen(function*() {
  yield* headerValue(value)
  const parts: string[] = []
  let start = 0, angle = false, quoted = false, escaped = false
  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    if (escaped) { escaped = false; continue }
    if (quoted && char === "\\") { escaped = true; continue }
    if (char === '"') quoted = !quoted
    else if (!quoted && char === "<") {
      if (angle) return yield* refuse(`malformed mail address list: ${value}`)
      angle = true
    } else if (!quoted && char === ">") {
      if (!angle) return yield* refuse(`malformed mail address list: ${value}`)
      angle = false
    } else if (!quoted && !angle && char === ",") { parts.push(value.slice(start, i)); start = i + 1 }
  }
  if (quoted || angle || escaped) return yield* refuse(`malformed mail address list: ${value}`)
  parts.push(value.slice(start))
  return yield* Result.all(parts.map(part => Result.map(mailbox(part), parsed => parsed.address)))
})
/** Validate caller-supplied data before fetching reply metadata. */
export const validateDraft = (args: DraftArgs) => Result.gen(function*() {
  const recipients = [...args.to ?? [], ...args.cc ?? [], ...args.bcc ?? []]
  if (recipients.length + (args.thread && args.to === undefined ? 1 : 0) > 50) return yield* refuse("mail drafts allow at most 50 recipients")
  yield* Result.all(recipients.map(mailbox))
  if (args.subject !== undefined) yield* headerValue(args.subject)
  if (!args.body.trim()) return yield* refuse("mail draft body cannot be empty")
  if (Buffer.byteLength(args.body, "utf8") > 256 * 1024) return yield* refuse("mail draft body exceeds 256 KiB")
  if (args.thread !== undefined && !/^[0-9a-f]+$/i.test(args.thread)) return yield* refuse("malformed mail thread id")
  if (args.draft !== undefined && !/^[A-Za-z0-9_-]+$/.test(args.draft)) return yield* refuse("malformed mail draft id")
  if (args.to !== undefined && !args.to.length) return yield* refuse("mail drafts require at least one To recipient")
  if (!args.thread && (!args.to?.length || args.subject === undefined)) return yield* refuse("new mail drafts require To and Subject")
})
/** Base64 at the 76 columns MIME asks for. An empty file has no lines at all,
 *  which is a part with an empty body rather than a throw. */
const base64 = (data: Buffer): string => data.toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? ""
/** RFC 5987/2231's attr-char: everything else in a filename is percent-encoded
 *  from its UTF-8 bytes, so `filename*` carries names no quoted string can. */
const ATTR_CHAR = /[A-Za-z0-9!#$&+\-.^_`|~]/
const extended = (name: string): string => `UTF-8''${[...Buffer.from(name, "utf8")]
  .map(byte => ATTR_CHAR.test(String.fromCharCode(byte)) ? String.fromCharCode(byte) : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`)
  .join("")}`
/** ONE ATTACHMENT AS A PART. Its two names say the same thing twice, as every
 *  mailer does: `name=` on the type for readers that only look there, and
 *  `filename` on the disposition for everyone else. An ASCII name that needs no
 *  quoting goes out quoted; anything else takes RFC 2231 on the disposition and
 *  an RFC 2047 word on the type, because those are the two encodings each
 *  parameter has. */
const enclosurePart = (boundary: string, one: Enclosure) => Result.gen(function*() {
  if (CONTROL.test(one.filename)) return yield* refuse("mail attachment filenames cannot contain CR, LF or control characters")
  if (!one.filename.trim()) return yield* refuse("mail attachments need a filename to arrive under")
  if (!contentType(one.type)) return yield* refuse(`malformed mail attachment content type: ${JSON.stringify(one.type)}`)
  // A name that is plain ASCII with no quoted-pair character goes out as
  // itself. Anything else takes the encoded words UNCONDITIONALLY — `encoded`'s
  // short-ASCII shortcut would hand `say "hi".txt` back verbatim and end the
  // quoted string early.
  const plain = !/[^\x20-\x7e]/.test(one.filename) && !/["\\]/.test(one.filename)
  return [
    `--${boundary}`,
    `Content-Type: ${one.type};`,
    ` name="${plain ? one.filename : encodedWords(one.filename)}"`,
    "Content-Disposition: attachment;",
    plain ? ` filename="${one.filename}"` : ` filename*=${extended(one.filename)}`,
    "Content-Transfer-Encoding: base64",
    "",
    base64(one.data),
  ].join("\r\n")
})
/** The message itself. With no attachments this is the single `text/plain`
 *  part it has always been, byte for byte; with some it is `multipart/mixed`,
 *  the text first and one part per file after it.
 *
 *  The boundary carries `=`, which no base64 line can hold in the middle and no
 *  header this composer writes can produce — so the delimiter cannot appear
 *  inside a part, whatever the parts hold. */
export const compose = (args: DraftArgs & { from: string; to: ReadonlyArray<string>; subject: string; inReplyTo?: string; references?: string }, attachments: ReadonlyArray<Enclosure> = []) => Result.gen(function*() {
  yield* validateDraft(args)
  const headers = [`From: ${yield* recipient(args.from)}`]
  for (const [name, values] of [["To", args.to], ["Cc", args.cc], ["Bcc", args.bcc]] as const) if (values?.length) headers.push(`${name}: ${(yield* Result.all(values.map(recipient))).join(",\r\n ")}`)
  headers.push(`Subject: ${subjectHeader(yield* headerValue(args.subject))}`)
  if (args.inReplyTo) headers.push(`In-Reply-To: ${yield* headerValue(args.inReplyTo)}`)
  if (args.references) headers.push(`References: ${(yield* headerValue(args.references)).trim().split(/\s+/).join("\r\n ")}`)
  const body = Buffer.from(args.body).toString("base64").match(/.{1,76}/g)!.join("\r\n")
  if (!attachments.length) {
    headers.push("MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64")
    return headers.join("\r\n") + "\r\n\r\n" + body + "\r\n"
  }
  const boundary = `=_olai_${randomUUID()}`
  headers.push("MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${boundary}"`)
  const parts = [[`--${boundary}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", body].join("\r\n")]
  for (const one of attachments) parts.push(yield* enclosurePart(boundary, one))
  return headers.join("\r\n") + "\r\n\r\n" + parts.join("\r\n") + `\r\n--${boundary}--\r\n`
})
