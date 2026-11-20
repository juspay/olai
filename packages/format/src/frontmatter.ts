import type { Custom, CustomValue } from "./custom.ts"
import { nothing } from "./write.ts"

export const proseIn = (body: string): string => {
  const matter = matterIn(body)
  return matter === null ? body : body.slice(matter.from)
}

export const proseLineOffset = (body: string): number =>
  body.slice(0, body.length - proseIn(body).length).split("\n").length - 1

export const frontmatterIn = (body: string): Custom => {
  const matter = matterIn(body)
  return matter === null ? NO_PROPS : propsIn(matter.text)
}

const NO_PROPS: Custom = {}

export const matterWith = (
  text: string,
  changes: ReadonlyArray<readonly [key: string, value: string | null]>,
): string => {
  const matter = matterIn(text)
  const from = matter === null ? 0 : text.indexOf("\n") + 1
  const lines = matter === null ? [] : linesOf(matter.text)
  const entries = entriesOf(lines)
  const gone = new Set<number>()
  const rewritten = new Map<number, string>()
  const appended = new Map<string, string>()
  const ending = text.includes("\r\n") ? "\r\n" : "\n"
  for (const [key, value] of changes) {
    const mine = entries.filter((entry) => entry.key === key)
    appended.delete(key)
    for (const entry of mine) {
      for (let at = entry.from; at <= entry.to; at++) gone.add(at)
      rewritten.delete(entry.from)
    }
    if (value === null) continue
    const written = spelled(key, value)
    const first = mine[0]
    if (first === undefined) {
      appended.set(key, written + ending)
      continue
    }
    gone.delete(first.from)
    const was = lines[first.from] as string
    rewritten.set(first.from, written + (was.endsWith("\r\n") ? "\r\n" : was.endsWith("\n") ? "\n" : ""))
  }
  const region = lines.map((line, at) => gone.has(at) ? "" : rewritten.get(at) ?? line).join("")
    + [...appended.values()].join("")
  if (region.trim() === "") return matter === null ? text : text.slice(matter.from)
  if (matter === null) return `---${ending}${region}---${ending}${text}`
  return text.slice(0, from) + region + text.slice(from + matter.text.length)
}

const linesOf = (region: string): ReadonlyArray<string> => region.match(/[^\n]*\n|[^\n]+/g) ?? []

const flatten = (line: string): string => untrailed(line.endsWith("\n") ? line.slice(0, -1) : line)

const entriesOf = (
  lines: ReadonlyArray<string>,
): ReadonlyArray<{ readonly key: string; readonly from: number; readonly to: number }> => {
  const found: Array<{ key: string; from: number; to: number }> = []
  for (let at = 0; at < lines.length; at++) {
    const flat = flatten(lines[at] as string)
    const text = flat.trimStart()
    if (text === "" || text.startsWith("#")) continue
    if (sequenceItem(text) !== null || flat !== text) continue
    const split = splitKey(text)
    if (split === null) continue
    let last = at
    for (let look = at + 1; look < lines.length; look++) {
      const next = flatten(lines[look] as string)
      const word = next.trimStart()
      if (word === "" || word.startsWith("#")) continue
      if (sequenceItem(word) === null && next === word) break
      last = look
    }
    found.push({ key: split[0], from: at, to: last })
    at = last
  }
  return found
}

const spelled = (key: string, value: string): string => {
  const plainly = `${key}: ${value}`
  return propsIn(plainly)[key] === value ? plainly : `${key}: ${quotedValue(value)}`
}

const quotedValue = (value: string): string =>
  `"${value.replace(/[\\"]/g, (one) => `\\${one}`).replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`

const matterIn = (body: string): { readonly text: string; readonly from: number } | null => {
  if (body.charCodeAt(0) !== DASH) return null
  const opens = body.indexOf("\n")
  if (opens === -1 || !isFence(body, 0, opens)) return null
  let at = opens + 1
  while (at < body.length) {
    const end = body.indexOf("\n", at)
    if (isFence(body, at, end === -1 ? body.length : end)) {
      return { text: body.slice(opens + 1, at), from: end === -1 ? body.length : end + 1 }
    }
    if (end === -1) break
    at = end + 1
  }
  return null
}

const DASH = "-".charCodeAt(0)
const SPACE = " ".charCodeAt(0)
const TAB = "\t".charCodeAt(0)
const RETURN = "\r".charCodeAt(0)

const isFence = (text: string, from: number, to: number): boolean =>
  to - from >= 3 && text.charCodeAt(from) === DASH && text.charCodeAt(from + 1) === DASH &&
  text.charCodeAt(from + 2) === DASH && blank(text, from + 3, to)

const blank = (text: string, from: number, to: number): boolean => {
  for (let at = from; at < to; at++) {
    const char = text.charCodeAt(at)
    if (char !== SPACE && char !== TAB && char !== RETURN) return false
  }
  return true
}

const propsIn = (region: string): Custom => {
  const props: Record<string, CustomValue> = {}
  let open: { readonly key: string; readonly items: Array<string> } | null = null
  const close = (): void => {
    if (open !== null) claim(props, open.key, open.items)
    open = null
  }
  for (const raw of region.split("\n")) {
    const line = untrailed(raw)
    const text = line.trimStart()
    if (text === "" || text.startsWith("#")) continue
    const item = sequenceItem(text)
    if (item !== null) {
      if (open === null) continue
      const value = scalarOf(item)
      if (value === null || value === "") {
        open = null
        continue
      }
      open.items.push(value)
      continue
    }
    close()
    if (line !== text) continue
    const split = splitKey(text)
    if (split === null) continue
    const [key, rest] = split
    if (rest === "") {
      open = { key, items: [] }
      continue
    }
    const value = valueIn(rest)
    if (value !== null) claim(props, key, value)
  }
  close()
  return props
}

const untrailed = (line: string): string => {
  let end = line.length
  while (end > 0) {
    const code = line.charCodeAt(end - 1)
    if (code !== 0x20 && code !== 0x09 && code !== 0x0d) break
    end--
  }
  return end === line.length ? line : line.slice(0, end)
}

const claim = (
  props: Record<string, CustomValue>,
  key: string,
  value: CustomValue,
): void => {
  if (key in props || nothing(value)) return
  props[key] = value
}

const sequenceItem = (text: string): string | null => {
  if (!text.startsWith("-")) return null
  const after = text[1]
  if (after === undefined) return ""
  if (after !== " " && after !== "\t") return null
  return text.slice(2).trim()
}

const splitKey = (text: string): readonly [key: string, rest: string] | null => {
  let at = text.indexOf(":")
  while (at !== -1) {
    const after = text[at + 1]
    if (after === undefined || after === " " || after === "\t") {
      const key = text.slice(0, at).trimEnd()
      return key === "" || key.startsWith("#") ? null : [key, text.slice(at + 1).trim()]
    }
    at = text.indexOf(":", at + 1)
  }
  return null
}

const valueIn = (text: string): CustomValue | null =>
  text.startsWith("[") && text.endsWith("]")
    ? flowSequence(text.slice(1, -1))
    : scalarOf(text)

const scalarOf = (text: string): string | null => {
  const first = text[0]
  if (first === undefined) return ""
  if (first === '"' || first === "'") return quoted(text, first)
  if (first === "[" || first === "{" || first === "&" || first === "*" || first === "!") {
    return null
  }
  if ((first === "|" || first === ">") && blank(text, 1, text.length)) return null
  if (first === "#") return ""
  return plain(text)
}

const plain = (text: string): string => {
  for (let at = 1; at < text.length; at++) {
    const before = text[at - 1]
    if (text[at] === "#" && (before === " " || before === "\t")) return text.slice(0, at).trimEnd()
  }
  return text
}

const quoted = (text: string, quote: string): string | null => {
  if (text.length < 2 || !text.endsWith(quote)) return null
  const inside = text.slice(1, -1)
  if (quote === "'") {
    return /(^|[^'])'([^']|$)/.test(inside) ? null : inside.replace(/''/g, "'")
  }
  let out = ""
  for (let at = 0; at < inside.length; at++) {
    const char = inside[at] as string
    if (char !== "\\") {
      if (char === '"') return null
      out += char
      continue
    }
    const next = inside[at + 1]
    if (next === '"' || next === "\\") {
      out += next
      at++
      continue
    }
    out += char
  }
  return out
}

const flowSequence = (inside: string): ReadonlyArray<string> | null => {
  if (inside.trim() === "") return []
  const members: Array<string> = []
  let from = 0
  let quote: string | null = null
  for (let at = 0; at <= inside.length; at++) {
    const char = inside[at]
    if (quote !== null) {
      if (char === undefined) return null
      if (char === "\\" && quote === '"') at++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === "#" && (inside[at - 1] === " " || inside[at - 1] === "\t")) return null
    if (char !== "," && char !== undefined) continue
    const value = scalarOf(inside.slice(from, at).trim())
    from = at + 1
    if (value === null || value === "") return null
    members.push(value)
  }
  return members
}
