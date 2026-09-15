/** Stories derive only from the persisted tool reply, never live mailbox state. */
export const storyOf = (reply: unknown): { kind: string; text: string } | null => {
  if (typeof reply !== "object" || reply === null) return null
  const r = reply as Record<string, any>
  if (typeof r.reason === "string") return { kind: "refused", text: r.reason }
  if (r.detail?.reason) return { kind: "refused", text: r.detail.reason }
  const kind = r.mail
  if (typeof kind !== "string") return null
  const change = r.changed as { added: string[]; removed: string[] } | undefined
  const moved = change ? [...change.added.map(x => `+${x}`), ...change.removed.map(x => `−${x}`)].join(" ") : ""
  const text = kind === "inbox" ? `${r.threads.length} threads in INBOX`
    : kind === "search" ? `${r.threads.length} threads for ${JSON.stringify(r.query)}`
    : kind === "thread" ? `${r.subject} · ${r.messages[0]?.from ?? ""} · ${r.messages.length} messages`
    : kind === "attachment" ? `${r.filename} · ${r.bytes >= 1024 ? `${r.bytes / 1024} KiB` : `${r.bytes} bytes`}`
    : kind === "archive" ? `archived${moved ? ` · ${moved}` : " · nothing changed"}`
    : kind === "trash" ? `trashed${moved ? ` · ${moved}` : " · nothing changed"}`
    : kind === "untrash" ? `restored from Trash${moved ? ` · ${moved}` : " · nothing changed"}`
    : kind === "read" ? (change?.removed.includes("UNREAD") ? "marked read" : change?.added.includes("UNREAD") ? "marked unread" : "nothing changed")
    : moved || "nothing changed"
  return { kind, text }
}
