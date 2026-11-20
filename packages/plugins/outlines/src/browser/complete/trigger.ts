import { isTagName, TAG_SIGILS, type TagSigil, tagOpensAt } from "@olai/format"

export type Trigger =
  | { readonly kind: "date"; readonly from: number; readonly query: string }
  | {
    readonly kind: "tag"
    readonly sigil: TagSigil
    readonly from: number
    readonly query: string
  }
  | { readonly kind: "mirror"; readonly from: number; readonly query: string }

const DAY_CAP = 24

const SEARCH_CAP = 48

export const sameTrigger = (was: Trigger | null, is: Trigger | null): boolean =>
  was === is ||
  (was !== null && is !== null &&
    was.kind === is.kind && was.from === is.from && was.query === is.query &&
    (was.kind !== "tag" || is.kind !== "tag" || was.sigil === is.sigil))

export const triggerIn = (text: string, caret: number): Trigger | null => {
  const before = text.slice(0, Math.max(0, caret))
  const brackets = bracketsIn(before)
  const sigil = sigilIn(before)
  if (sigil === null) return brackets
  if (brackets === null) return sigil
  return sigil.from > brackets.from ? sigil : brackets
}

const bracketsIn = (before: string): Trigger | null => {
  const at = before.lastIndexOf("((")
  if (at === -1) return null
  const query = before.slice(at + 2)
  return query.length <= SEARCH_CAP && !query.includes(")")
    ? { kind: "mirror", from: at, query }
    : null
}

const sigilIn = (before: string): Trigger | null => {
  for (let at = before.length - 1; at >= 0; at--) {
    const char = before[at] as string
    if (char !== "!" && !TAG_SIGILS.includes(char as TagSigil)) continue
    if (!tagOpensAt(before, at)) continue
    const query = before.slice(at + 1)
    if (char === "!") {
      return query.length <= DAY_CAP && !query.startsWith(" ") && !query.includes("!")
        ? { kind: "date", from: at, query }
        : null
    }
    return isTagName(query)
      ? { kind: "tag", sigil: char as TagSigil, from: at, query }
      : null
  }
  return null
}

export { written, type Written } from "@olai/markdown-ui/insert.ts"
