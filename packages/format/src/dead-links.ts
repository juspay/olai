/** Missing relative targets are a reading of a revision, never a verdict. */
import { Schema } from "effect"
import { pathedOf, writtenLinks } from "./documents.ts"
import { isMirror, type Located } from "./node.ts"
import { basenameOf } from "./paths.ts"
import { nearestId } from "./suggest.ts"

export const DeadLink = Schema.Struct({
  written: Schema.String,
  resolved: Schema.String,
  suggest: Schema.Array(Schema.String),
})
export type DeadLink = typeof DeadLink.Type

/** Spell a served path beside the file whose prose names it. */
export const relativeFrom = (from: string, path: string): string => {
  const directory = from.split("/").slice(0, -1)
  const target = path.split("/")
  let same = 0
  while (same < directory.length && same < target.length && directory[same] === target[same]) same++
  return [...directory.slice(same).map(() => ".."), ...target.slice(same)].join("/")
}

/** Code is displayed literally, so it cannot introduce a link warning. */
const proseLinks = (text: string): ReadonlyArray<string> => {
  if (!text.includes("](")) return []
  let listIndent: number | undefined
  let fence: { marker: string; length: number } | undefined
  const lines = text.split("\n").map(line => {
    // List continuation indentation belongs to prose; four further spaces
    // introduce code within that item. Blank lines retain the list context.
    const indent = /^( *)/.exec(line)![1]!.length
    // Literal fence contents cannot change the list context of its closer.
    if (fence === undefined) {
      const item = /^( *)(?:[-+*]|\d+[.)]) +/.exec(line)
      if (item && indent < (listIndent ?? 0) + 4) listIndent = item[0].length
      else if (line.trim() !== "" && listIndent !== undefined && indent < listIndent) listIndent = undefined
    }
    const content = listIndent === undefined ? line : line.slice(Math.min(indent, listIndent))
    const match = /^(?: {0,3}> ?)* {0,3}(`{3,}|~{3,})(.*)$/.exec(content)
    if (fence !== undefined) {
      if (match && match[1]![0] === fence.marker && match[1]!.length >= fence.length && match[2]!.trim() === "") fence = undefined
      return ""
    }
    if (match && (match[1]![0] !== "`" || !match[2]!.includes("`"))) {
      fence = { marker: match[1]![0]!, length: match[1]!.length }
      return ""
    }
    return /^( {4}|\t)/.test(content) ? "" : content
  }).join("\n")
  let prose = ""
  for (let i = 0; i < lines.length;) {
    if (lines[i] === "\\") { prose += lines.slice(i, i + 2); i += 2; continue }
    if (lines[i] !== "`") { prose += lines[i++]; continue }
    let end = i
    while (lines[end] === "`") end++
    const marker = lines.slice(i, end)
    let close = lines.indexOf(marker, end)
    while (close !== -1 && (lines[close - 1] === "`" || lines[close + marker.length] === "`")) close = lines.indexOf(marker, close + marker.length)
    if (close === -1) { prose += marker; i = end }
    else { prose += " "; i = close + marker.length }
  }
  return writtenLinks(prose)
}

/** File targets only. Queries and fragments belong to navigation, not membership. */
export const deadLinkTarget = (from: string, written: string): string | null => {
  const path = written.split(/[?#]/, 1)[0] ?? ""
  const decoded = (() => { try { return decodeURIComponent(path) } catch { return path } })()
  if (decoded === "" || decoded.endsWith("/") || [".", ".."].includes(decoded.split("/").at(-1) ?? "")) return null
  const resolved = pathedOf(from, path)
  return resolved === "" ? null : resolved
}

/** Scan fields independently: a title and note cannot complete each other's Markdown. */
export const deadLinksIn = (from: string, text: string | ReadonlyArray<string>, served: ReadonlySet<string>): ReadonlyArray<DeadLink> => {
  const found: DeadLink[] = []
  const seen = new Set<string>()
  for (const written of (typeof text === "string" ? proseLinks(text) : text.flatMap(proseLinks))) {
    const resolved = deadLinkTarget(from, written)
    if (resolved === null || served.has(resolved) || seen.has(written)) continue
    seen.add(written)
    const candidates = [...served].filter(path => basenameOf(path) === basenameOf(resolved))
    const nearest = candidates.length === 0 ? nearestId(resolved, served) : null
    if (nearest !== null) candidates.push(nearest)
    found.push({ written, resolved, suggest: candidates.map(path => relativeFrom(from, path)) })
  }
  return found
}

export const deadLinksOf = (at: Located, served: ReadonlySet<string>): ReadonlyArray<DeadLink> =>
  isMirror(at.node) ? [] : deadLinksIn(at.file, [at.node.title, at.node.desc ?? ""], served)

export const deadLinkSaid = (link: DeadLink): string =>
  `link resolves to nothing served: ${link.resolved}` +
  (link.suggest.length === 0 ? "." : ` — did you mean ${link.suggest.map(path => `\`${path}\``).join(" or ")}?`)

export const deadLinkFields = (links: ReadonlyArray<DeadLink>): { readonly deadLinks?: ReadonlyArray<DeadLink> } =>
  links.length === 0 ? {} : { deadLinks: links }
