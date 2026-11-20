import { NO_NEEDLES } from "@olai/markdown-ui/lit.ts"
import { taggedHtml } from "./tags.ts"

export const plainTitle = (
  title: string,
  needles: ReadonlyArray<string> = NO_NEEDLES,
): string | null => (isPlain(title) ? taggedHtml(title, needles) : null)

const LINE_BREAK_OR_TAB = /[\n\r\t]/
const INLINE_MARKUP = /[*_`[\]<>\\~|]/
const CHARACTER_REFERENCE = /&(?=[A-Za-z0-9#])/
const HASH_THAT_IS_NOT_A_TAG = /#(?![A-Za-z0-9_/-])/
const LIST_MARKER = /^(?:[-+]|\d{1,9}[.)])(?:\s|$)/
const RULE_OR_SETEXT = /^[-=\s]+$/
const URL = /(?::\/\/|\bwww\.|\bmailto:|\bxmpp:)/i
const EMAIL = /[\w.+-]+@[\w-]+\.[\w-]/

const REFUSED = [
  LINE_BREAK_OR_TAB,
  INLINE_MARKUP,
  CHARACTER_REFERENCE,
  HASH_THAT_IS_NOT_A_TAG,
  LIST_MARKER,
  RULE_OR_SETEXT,
  URL,
  EMAIL,
]

const isPlain = (title: string): boolean =>
  title !== "" && title === title.trim() && !REFUSED.some((refusal) => refusal.test(title))
