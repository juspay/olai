import { tagOpensAt } from "@olai/format"

import { type Written, written } from "@olai/markdown-ui/insert.ts"

export type Completing =
  | { readonly kind: "command"; readonly from: number; readonly query: string }
  | { readonly kind: "name"; readonly from: number; readonly query: string }

export const requiresSelection = (found: Completing | null): boolean =>
  found?.kind === "name" && found.query.includes(" ")

const NAME_CAP = 120

export const completingIn = (text: string, caret: number): Completing | null =>
  commandIn(text) ?? nameIn(text, caret)

const commandIn = (text: string): Completing | null => {
  if (!text.startsWith("/")) return null
  return text.includes(" ")
    ? null
    : { kind: "command", from: 0, query: text.slice(1) }
}

const nameIn = (text: string, caret: number): Completing | null => {
  const before = text.slice(0, Math.max(0, caret))
  const said = namesOf(before).at(-1)
  if (said === undefined) return null
  const query = before.slice(said.at + 1)
  return !/[^\S ]/.test(query) && query.length <= NAME_CAP
    ? { kind: "name", from: said.at, query }
    : null
}

export const tokenOf = (found: Completing): string =>
  `${found.kind}:${found.from}`

export const inserted = (name: string, followed = " "): string =>
  `@${name}${followed}`

export const namedIn = (
  text: string,
  taken: ReadonlySet<string>,
): ReadonlyArray<string> => {
  if (taken.size === 0) return []
  const named: Array<string> = []
  for (const found of namesOf(text)) {
    if (taken.has(found.word) && !named.includes(found.word)) named.push(found.word)
  }
  return named
}

export const unnamed = (text: string, id: string, caret: number): Written => {
  let out = ""
  let read = 0
  let moved = caret
  for (const found of namesOf(text)) {
    if (found.word !== id) continue
    const said = found.at + 1 + id.length
    const end = text[said] === " " ? said + 1 : said
    out += text.slice(read, found.at)
    read = end
    if (caret > found.at) moved -= Math.min(caret, end) - found.at
  }
  return { text: out + text.slice(read), caret: moved }
}

const SENTENCE_MARK = /[,.;:!?)\]}'"]/

const trimmedName = (word: string): string => {
  let end = word.length
  while (end > 0 && SENTENCE_MARK.test(word[end - 1] ?? "")) end--
  return word.slice(0, end)
}

const marksAt = (text: string, at: number): number => {
  let end = at
  while (end < text.length && SENTENCE_MARK.test(text[end] ?? "")) end++
  return end - at
}

const namesOf = (
  text: string,
): ReadonlyArray<{ readonly at: number; readonly word: string }> => {
  const found: Array<{ at: number; word: string }> = []
  for (let at = 0; at < text.length; at++) {
    if (text[at] !== "@" || !tagOpensAt(text, at)) continue
    const rest = text.slice(at + 1)
    const end = rest.search(/\s/)
    const said = end === -1 ? rest : rest.slice(0, end)
    found.push({ at, word: trimmedName(said) })
    at += said.length
  }
  return found
}

export const completed = (
  text: string,
  at: Completing,
  name: string,
  caret: number,
): Written => {
  const marks = marksAt(text, caret)
  if (marks > 0) {
    const put = written(text, at, inserted(name, ""), caret)
    return { ...put, caret: put.caret + marks }
  }
  return written(text, at, inserted(name), text[caret] === " " ? caret + 1 : caret)
}
