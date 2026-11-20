import { NO_NEEDLES } from "@olai/markdown-ui/lit.ts"
import { taggedHtml } from "./tags.ts"

export const plainTitle = (
  title: string,
  needles: ReadonlyArray<string> = NO_NEEDLES,
): string | null => (isPlain(title) ? taggedHtml(title, needles) : null)

const isPlain = (title: string): boolean => {
  if (title === "" || title !== title.trim()) return false
  if (/[\n\r\t]/.test(title)) return false

  if (/[*_`[\]<>\\~|]/.test(title)) return false

  if (/&(?=[A-Za-z0-9#])/.test(title)) return false

  if (/#(?![A-Za-z0-9_/-])/.test(title)) return false

  if (/^(?:[-+]|\d{1,9}[.)])(?:\s|$)/.test(title)) return false

  if (/^[-=\s]+$/.test(title)) return false

  if (/(?::\/\/|\bwww\.|\bmailto:|\bxmpp:)/i.test(title)) return false
  if (/[\w.+-]+@[\w-]+\.[\w-]/.test(title)) return false

  return true
}
