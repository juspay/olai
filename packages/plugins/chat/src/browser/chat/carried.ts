import type { ChatEntry } from "../../wire.ts"
import { diffOf } from "./diff.ts"
/** The row's source words. Streamed terminal output and progress stay out. */
export const textOf = (entry: ChatEntry): string | null => {
  let text: string
  switch (entry.kind) {
    case "agent": if (entry.streaming) return null; text = entry.text; break
    case "user": text = entry.text; break
    case "tool": text = [entry.text, entry.detail ?? (entry.reply === undefined ? "" : JSON.stringify(entry.reply, null, 2))].filter(Boolean).join("\n"); break
    default: return null
  }
  return text.trim() ? text : null
}
export const textOfDiff = (path: string, before: string | null, after: string): string =>
  [path, ...diffOf(before, after).lines.filter(line => line.kind === "add" || line.kind === "remove").map(line => `${line.kind === "add" ? "+" : "-"}${line.text}`)].join("\n")
