/** Stories derive only from persisted reply JSON, never live mailbox state. */
const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === "string")
export const storyOf = (reply: unknown): { kind: string; text: string } | null => {
  const r = record(reply)
  if (!r) return null
  const reason = r.reason ?? record(r.detail)?.reason
  if (typeof reason === "string") return { kind: "refused", text: reason }
  const kind = r.mail
  if (typeof kind !== "string") return null
  if (kind === "inbox" || kind === "search") {
    if (!Array.isArray(r.threads) || (kind === "search" && typeof r.query !== "string")) return null
    return { kind, text: `${r.threads.length} threads ${kind === "inbox" ? "in INBOX" : `for ${JSON.stringify(r.query)}`}` }
  }
  if (kind === "thread") {
    if (typeof r.subject !== "string" || !Array.isArray(r.messages)) return null
    const from = record(r.messages[0])?.from
    return { kind, text: `${r.subject} · ${typeof from === "string" ? from : ""} · ${r.messages.length} messages` }
  }
  if (kind === "draft" || kind === "draft_update") {
    if (!strings(r.to) || typeof r.subject !== "string") return null
    return { kind, text: `${kind === "draft_update" ? "draft updated" : `draft to ${r.to.join(", ")}`} · ${r.subject}` }
  }
  if (kind === "attachment") {
    if (typeof r.filename !== "string" || typeof r.bytes !== "number") return null
    return { kind, text: `${r.filename} · ${r.bytes >= 1024 ? `${Math.round(r.bytes / 102.4) / 10} KiB` : `${r.bytes} bytes`}` }
  }
  if (!["archive", "trash", "untrash", "label", "read"].includes(kind)) return null
  const change = record(r.changed)
  if (!change || !strings(change.added) || !strings(change.removed)) return null
  const moved = [...change.added.map(x => `+${x}`), ...change.removed.map(x => `−${x}`)].join(" ")
  const text = kind === "archive" ? `archived · ${moved || "nothing changed"}`
    : kind === "trash" ? `trashed · ${moved || "nothing changed"}`
    : kind === "untrash" ? `restored from Trash · ${moved || "nothing changed"}`
    : kind === "read" ? (change.removed.includes("UNREAD") ? "marked read" : change.added.includes("UNREAD") ? "marked unread" : "nothing changed")
    : moved || "nothing changed"
  return { kind, text }
}
