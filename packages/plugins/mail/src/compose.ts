/** Plain-text draft composition only. No capabilities or live mailbox state. */
import { Result } from "effect"
import { MailRefusal } from "./wire.ts"

export interface DraftArgs {
  readonly to?: ReadonlyArray<string>
  readonly cc?: ReadonlyArray<string>
  readonly bcc?: ReadonlyArray<string>
  readonly subject?: string
  readonly body: string
  readonly thread?: string
  readonly draft?: string
}
const refuse = (reason: string) => Result.fail(new MailRefusal({ reason }))
export const headerValue = (value: string): Result.Result<string, MailRefusal> => {
  if (/[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) return refuse("mail headers cannot contain CR, LF or control characters")
  return Result.succeed(value)
}
// Each encoded word fits RFC 2047's 75-character limit, split on code points.
const encoded = (value: string): string => {
  if (!/[^\x20-\x7e]/.test(value) && value.length <= 70) return value
  const chunks: string[] = []
  let chunk = ""
  for (const char of value) {
    if (Buffer.byteLength(chunk + char) > 42) { chunks.push(chunk); chunk = "" }
    chunk += char
  }
  if (chunk) chunks.push(chunk)
  return chunks.map(part => `=?UTF-8?B?${Buffer.from(part).toString("base64")}?=`).join("\r\n ")
}
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
  yield* Result.all(recipients.map(recipient))
  if (args.subject !== undefined) yield* headerValue(args.subject)
  if (!args.body.trim()) return yield* refuse("mail draft body cannot be empty")
  if (Buffer.byteLength(args.body, "utf8") > 256 * 1024) return yield* refuse("mail draft body exceeds 256 KiB")
  if (args.thread !== undefined && !/^[0-9a-f]+$/i.test(args.thread)) return yield* refuse("malformed mail thread id")
  if (args.draft !== undefined && !/^[A-Za-z0-9_-]+$/.test(args.draft)) return yield* refuse("malformed mail draft id")
  if (args.to !== undefined && !args.to.length) return yield* refuse("mail drafts require at least one To recipient")
  if (!args.thread && (!args.to?.length || args.subject === undefined)) return yield* refuse("new mail drafts require To and Subject")
})
export const compose = (args: DraftArgs & { from: string; to: ReadonlyArray<string>; subject: string; inReplyTo?: string; references?: string }) => Result.gen(function*() {
  yield* validateDraft(args)
  const headers = [`From: ${yield* recipient(args.from)}`, `To: ${(yield* Result.all(args.to.map(recipient))).join(",\r\n ")}`]
  for (const [name, values] of [["Cc", args.cc], ["Bcc", args.bcc]] as const) if (values?.length) headers.push(`${name}: ${(yield* Result.all(values.map(recipient))).join(",\r\n ")}`)
  headers.push(`Subject: ${subjectHeader(yield* headerValue(args.subject))}`)
  if (args.inReplyTo) headers.push(`In-Reply-To: ${yield* headerValue(args.inReplyTo)}`)
  if (args.references) headers.push(`References: ${(yield* headerValue(args.references)).trim().split(/\s+/).join("\r\n ")}`)
  headers.push("MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64")
  const body = Buffer.from(args.body).toString("base64").match(/.{1,76}/g)!.join("\r\n")
  return headers.join("\r\n") + "\r\n\r\n" + body + "\r\n"
})
