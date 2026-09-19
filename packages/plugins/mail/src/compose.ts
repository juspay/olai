/** Plain-text draft composition only. No capabilities or live mailbox state. */
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
const refuse = (reason: string): never => { throw new MailRefusal({ reason }) }
export const headerValue = (value: string): string => {
  if (/[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) refuse("mail headers cannot contain CR, LF or control characters")
  return value
}
// Each encoded word fits RFC 2047's 75-character limit, split on code points.
const encoded = (value: string): string => {
  if (!/[^\x20-\x7e]/.test(value)) return value
  const chunks: string[] = []
  let chunk = ""
  for (const char of value) {
    if (Buffer.byteLength(chunk + char) > 42) { chunks.push(chunk); chunk = "" }
    chunk += char
  }
  if (chunk) chunks.push(chunk)
  return chunks.map(part => `=?UTF-8?B?${Buffer.from(part).toString("base64")}?=`).join("\r\n ")
}
export const recipient = (value: string): string => {
  headerValue(value)
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(value.trim())
  const address = (match?.[2] ?? value).trim()
  const [local, domain, extra] = address.split("@")
  if (extra !== undefined || !local || !domain || local.length > 64 || address.length > 254
    || !/^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*$/.test(local)
    || !domain.split(".").every(label => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) refuse(`malformed mail address: ${value}`)
  if (!match) return address
  let name = match[1]!.trim()
  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1).replace(/\\(["\\])/g, "$1")
  if (!name || /[<>]/.test(name)) refuse(`malformed mail address: ${value}`)
  const display = /[^\x20-\x7e]/.test(name) ? encoded(name) : `"${name.replace(/["\\]/g, "\\$&")}"`
  return `${display} <${address}>`
}
/** Validate caller-supplied data before fetching reply metadata. */
export const validateDraft = (args: DraftArgs): void => {
  const recipients = [...args.to ?? [], ...args.cc ?? [], ...args.bcc ?? []]
  if (recipients.length > 50) refuse("mail drafts allow at most 50 recipients")
  recipients.forEach(recipient)
  if (args.subject !== undefined) headerValue(args.subject)
  if (!args.body.trim()) refuse("mail draft body cannot be empty")
  if (Buffer.byteLength(args.body, "utf8") > 256 * 1024) refuse("mail draft body exceeds 256 KiB")
  if (args.thread !== undefined && !/^[0-9a-f]+$/i.test(args.thread)) refuse("malformed mail thread id")
  if (args.draft !== undefined && !/^[A-Za-z0-9_-]+$/.test(args.draft)) refuse("malformed mail draft id")
  if (args.to !== undefined && !args.to.length) refuse("mail drafts require at least one To recipient")
  if (!args.thread && (!args.to?.length || args.subject === undefined)) refuse("new mail drafts require To and Subject")
}
export const compose = (args: DraftArgs & { from: string; to: ReadonlyArray<string>; subject: string; inReplyTo?: string; references?: string }): string => {
  validateDraft(args)
  const headers = [`From: ${recipient(args.from)}`, `To: ${args.to.map(recipient).join(", ")}`]
  for (const [name, values] of [["Cc", args.cc], ["Bcc", args.bcc]] as const) if (values?.length) headers.push(`${name}: ${values.map(recipient).join(", ")}`)
  headers.push(`Subject: ${encoded(headerValue(args.subject))}`)
  if (args.inReplyTo) headers.push(`In-Reply-To: ${headerValue(args.inReplyTo)}`)
  if (args.references) headers.push(`References: ${headerValue(args.references)}`)
  headers.push("MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64")
  const body = Buffer.from(args.body).toString("base64").match(/.{1,76}/g)!.join("\r\n")
  return headers.join("\r\n") + "\r\n\r\n" + body + "\r\n"
}
