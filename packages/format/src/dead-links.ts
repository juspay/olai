/** Missing relative targets are a reading of a revision, never a verdict. */
import { Schema } from "effect"
import { pathedOf, proseLinks, wikilinksIn } from "./documents.ts"
import type { Claims } from "./kinds.ts"
import { isMirror, type Located } from "./node.ts"
import { basenameOf } from "./paths.ts"
import { nearestId } from "./suggest.ts"
import { namesIn, wikilinkPath, wikilinkSuggestions } from "./wikilinks.ts"

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

/** File targets only. Queries and fragments belong to navigation, not membership. */
export const deadLinkTarget = (from: string, written: string): string | null => {
  const path = written.split(/[?#]/, 1)[0] ?? ""
  const decoded = (() => { try { return decodeURIComponent(path) } catch { return path } })()
  if (decoded === "" || decoded.endsWith("/") || [".", ".."].includes(decoded.split("/").at(-1) ?? "")) return null
  const resolved = pathedOf(from, path)
  return resolved === "" ? null : resolved
}

/**
 * Scan fields independently: a title and note cannot complete each other's
 * Markdown.
 *
 * A WIKILINK is dead when its name finds no served file from where it was
 * written (`./wikilinks.ts`). It is reported written as `[[name]]`, its
 * `resolved` is the name it looked for, and what it suggests is written as a
 * wikilink too. A link to a heading of the writer itself (`[[#Part]]`) names
 * no file and is never dead, as a standard `[x](#part)` is not.
 */
export const deadLinksIn = (
  claims: Claims,
  from: string,
  text: string | ReadonlyArray<string>,
  served: ReadonlySet<string>,
): ReadonlyArray<DeadLink> => {
  const found: DeadLink[] = []
  const seen = new Set<string>()
  const texts = typeof text === "string" ? [text] : text
  for (const written of texts.flatMap(proseLinks)) {
    const resolved = deadLinkTarget(from, written)
    if (resolved === null || served.has(resolved) || seen.has(written)) continue
    seen.add(written)
    const candidates = [...served].filter(path => basenameOf(path) === basenameOf(resolved))
    const nearest = candidates.length === 0 ? nearestId(resolved, served) : null
    if (nearest !== null) candidates.push(nearest)
    found.push({ written, resolved, suggest: candidates.map(path => relativeFrom(from, path)) })
  }
  for (const link of texts.flatMap(wikilinksIn)) {
    if (link.target === "") continue
    const written = `${link.embed ? "!" : ""}[[${link.name}]]`
    if (seen.has(written)) continue
    const names = namesIn(claims, served)
    if (wikilinkPath(names, claims, from, link.target) !== null) continue
    seen.add(written)
    found.push({ written, resolved: link.target, suggest: wikilinkSuggestions(names, claims, link.target) })
  }
  return found
}

export const deadLinksOf = (claims: Claims, at: Located, served: ReadonlySet<string>): ReadonlyArray<DeadLink> =>
  isMirror(at.node) ? [] : deadLinksIn(claims, at.file, [at.node.title, at.node.desc ?? ""], served)

/** Whether a dead link was written as a wikilink rather than as a path. */
const isWikilink = (link: DeadLink): boolean => link.written.startsWith("[[") || link.written.startsWith("![[")

export const deadLinkSaid = (link: DeadLink): string =>
  (isWikilink(link)
    ? `no file is named ${link.resolved}`
    : `link resolves to nothing served: ${link.resolved}`) +
  (link.suggest.length === 0 ? "." : ` — did you mean ${link.suggest.map(path => `\`${path}\``).join(" or ")}?`)

export const deadLinkFields = (links: ReadonlyArray<DeadLink>): { readonly deadLinks?: ReadonlyArray<DeadLink> } =>
  links.length === 0 ? {} : { deadLinks: links }
