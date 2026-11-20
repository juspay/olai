import { Slug } from "./address.ts"
import { proseIn } from "./frontmatter.ts"

export const slugOf = (text: string): Slug =>
  Slug.make(text.toLowerCase().replace(DROPPED, "").replace(/ /g, "-"))

const DROPPED = /[^\p{L}\p{N}\-_ ]/gu

export const slugsIn = (body: string): ReadonlyArray<Slug> =>
  deduped(headingsIn(body).map(slugOf))

const deduped = (slugs: ReadonlyArray<Slug>): ReadonlyArray<Slug> => {
  const seen = new Map<string, number>()
  const given: Array<Slug> = []
  for (const slug of slugs) {
    if (slug === "") continue
    given.push(claim(seen, slug))
  }
  return given
}

export const claim = (seen: Map<string, number>, slug: Slug): Slug => {
  let taken: Slug = slug
  while (seen.has(taken)) {
    const count = (seen.get(slug) ?? 0) + 1
    seen.set(slug, count)
    taken = Slug.make(`${slug}-${count}`)
  }
  seen.set(taken, 0)
  return taken
}

export const headingsIn = (body: string): ReadonlyArray<string> => {
  const found: Array<string> = []
  let fence: string | null = null
  let previous: string | null = null
  const text = proseIn(body)
  let at = 0
  while (at <= text.length) {
    const end = text.indexOf("\n", at)
    const line = (end === -1 ? text.slice(at) : text.slice(at, end)).trim()
    at = end === -1 ? text.length + 1 : end + 1
    if (fence !== null) {
      if (closes(line, fence)) fence = null
      previous = null
      continue
    }
    const opened = opensFence(line)
    if (opened !== null) {
      fence = opened
      previous = null
      continue
    }
    const atx = headingText(line)
    if (atx !== null) {
      found.push(atx)
      previous = null
      continue
    }
    if (previous !== null && SETEXT.test(line)) {
      found.push(previous)
      previous = null
      continue
    }
    previous = line === "" ? null : line
  }
  return found
}

export const headingText = (line: string): string | null => {
  let opens = 0
  while (opens < line.length && line[opens] === "#") opens++
  if (opens === 0 || opens > 6) return null
  const after = line[opens]
  if (after !== " " && after !== "\t") return null
  let end = line.length
  while (end > opens && line[end - 1] === "#") end--
  if (end < line.length) {
    let before = end
    while (before > opens && (line[before - 1] === " " || line[before - 1] === "\t")) before--
    if (before < end) end = before
    else end = line.length
  }
  return line.slice(opens, end).trim()
}

const SETEXT = /^(?:=+|-+)$/

const runOf = (line: string, char: string): number => {
  let length = 0
  while (length < line.length && line[length] === char) length++
  return length
}

const opensFence = (line: string): string | null => {
  for (const char of FENCES) {
    const length = runOf(line, char)
    if (length >= 3) return char.repeat(length)
  }
  return null
}

const FENCES = ["`", "~"] as const

const closes = (line: string, fence: string): boolean => {
  const length = runOf(line, fence[0]!)
  return length >= fence.length && line.slice(length).trim() === ""
}
