/** Pure readers of the pinned, schema-checked JSON. MIME bytes never enter the vault. */
import { Schema } from "effect"

const Header = Schema.Struct({ name: Schema.String, value: Schema.String })
export interface Part {
  readonly mimeType?: string | null
  readonly filename?: string
  readonly body?: { readonly attachmentId?: string | null; readonly size: number; readonly data?: string | null } | null
  readonly parts?: ReadonlyArray<Part>
}
const PartSchema: Schema.Codec<Part> = Schema.suspend(() => Schema.Struct({
  mimeType: Schema.optionalKey(Schema.NullOr(Schema.String)),
  filename: Schema.optionalKey(Schema.String),
  body: Schema.optionalKey(Schema.NullOr(Schema.Struct({
    attachmentId: Schema.optionalKey(Schema.NullOr(Schema.String)), size: Schema.Number,
    data: Schema.optionalKey(Schema.NullOr(Schema.String)),
  }))),
  parts: Schema.optionalKey(Schema.Array(PartSchema)),
}))
export const Thread = Schema.Struct({ id: Schema.String, messages: Schema.Array(Schema.Struct({
  id: Schema.String, "label-ids": Schema.Array(Schema.String), headers: Schema.Array(Header),
  snippet: Schema.optionalKey(Schema.NullOr(Schema.String)), payload: Schema.optionalKey(Schema.NullOr(PartSchema)),
})) })
export type Thread = typeof Thread.Type
export const Listing = Schema.Struct({ threads: Schema.Array(Schema.Struct({ id: Schema.String })), next_page: Schema.optionalKey(Schema.NullOr(Schema.String)) })
export const LabelList = Schema.Struct({ labels: Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String })) })
export const header = (message: Thread["messages"][number] | undefined, name: string): string =>
  message?.headers.filter(h => h.name.toLowerCase() === name.toLowerCase()).map(h => h.value).join(", ") ?? ""
export const idsOf = (thread: Thread): string[] => [...new Set(thread.messages.flatMap(m => m["label-ids"]))]
export const delta = (before: ReadonlyArray<string>, after: ReadonlyArray<string>) => ({ added: after.filter(x => !before.includes(x)), removed: before.filter(x => !after.includes(x)) })
export const rowOf = (thread: Thread, names: (ids: ReadonlyArray<string>) => string[]) => ({
  id: thread.id, subject: header(thread.messages[0], "subject"), from: header(thread.messages[0], "from"),
  date: header(thread.messages.at(-1), "date"), messages: thread.messages.length,
  unread: idsOf(thread).includes("UNREAD"), snippet: thread.messages.at(-1)?.snippet ?? "", labels: names(idsOf(thread)),
})
export const BODY_LIMIT = 64 * 1024
export const NOTICE = "\n[mail body truncated at 64 KiB]"
export const partsOf = (part: Part | null | undefined): { text: string | null; html: string | null; truncated: boolean; attachments: { id: string; filename: string; mime: string; bytes: number }[] } => {
  const answer = { text: null as string | null, html: null as string | null, truncated: false, attachments: [] as { id: string; filename: string; mime: string; bytes: number }[] }
  const bodies: Record<"text" | "html", Buffer[]> = { text: [], html: [] }
  const walk = (p: Part): void => {
    if (p.body?.attachmentId) {
      answer.attachments.push({ id: p.body.attachmentId, filename: p.filename || "attachment", mime: p.mimeType || "application/octet-stream", bytes: p.body.size })
      return
    }
    if (!p.filename && p.body?.data != null) {
      const kind = p.mimeType === "text/plain" ? "text" : p.mimeType === "text/html" ? "html" : null
      if (kind) bodies[kind].push(Buffer.from(p.body.data, "base64url"))
    }
    for (const child of p.parts ?? []) walk(child)
  }
  if (part) walk(part)
  for (const kind of ["text", "html"] as const) {
    if (!bodies[kind].length) continue
    const bytes = Buffer.concat(bodies[kind])
    const truncated = bytes.length > BODY_LIMIT
    let end = Math.min(bytes.length, BODY_LIMIT)
    if (truncated) while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end--
    answer[kind] = bytes.subarray(0, end).toString("utf8") + (truncated ? NOTICE : "")
    answer.truncated ||= truncated
  }
  return answer
}
export const fullOf = (address: string, thread: Thread, names: (ids: ReadonlyArray<string>) => string[]) => ({
  address, id: thread.id, subject: header(thread.messages[0], "subject"), labels: names(idsOf(thread)),
  messages: thread.messages.map(m => ({ id: m.id, from: header(m, "from"), to: header(m, "to"), cc: header(m, "cc"), date: header(m, "date"), labels: names(m["label-ids"]), ...partsOf(m.payload) })),
})
