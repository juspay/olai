/** Missing relative targets are a reading of a revision, never a verdict. */
import { Schema } from "effect"
import type { Read } from "@olai/prose/read.ts"
import { pathedOf } from "./documents.ts"
import { recordRead } from "./kept.ts"
import { isMirror, type Located } from "./node.ts"
import { basenameOf } from "./paths.ts"
import { nearestId } from "./suggest.ts"
import { type Names, wikilinkPath, wikilinkSuggestions } from "./wikilinks.ts"

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
 * The dead links of some readings — each text's own (`@olai/prose`'s `read`),
 * so a title and a note cannot complete each other's Markdown, and code, a
 * comment or an escape holds no link. `names` is the membership they are read
 * against — a revision's own (`Reading.names`), or one a planned write builds
 * for the files it adds.
 *
 * A WIKILINK is dead when its name finds no served file from where it was
 * written (`./wikilinks.ts`). It is reported written as `[[name]]`, its
 * `resolved` is the name it looked for, and what it suggests is written as a
 * wikilink too. A link to a heading of the writer itself (`[[#Part]]`) names
 * no file and is never dead, as a standard `[x](#part)` is not.
 */
export const deadLinksIn = (
  names: Names,
  from: string,
  reads: ReadonlyArray<Read>,
): ReadonlyArray<DeadLink> => {
  const { claims, served } = names
  const found: DeadLink[] = []
  const seen = new Set<string>()
  for (const link of reads.flatMap((said) => said.links)) {
    const written = link.url
    const resolved = deadLinkTarget(from, written)
    if (resolved === null || served.has(resolved) || seen.has(written)) continue
    seen.add(written)
    const candidates = [...served].filter(path => basenameOf(path) === basenameOf(resolved))
    const nearest = candidates.length === 0 ? nearestId(resolved, served) : null
    if (nearest !== null) candidates.push(nearest)
    found.push({ written, resolved, suggest: candidates.map(path => relativeFrom(from, path)) })
  }
  for (const link of reads.flatMap((said) => said.wikilinks)) {
    if (link.target === "") continue
    const written = `${link.embed ? "!" : ""}[[${[link.target, ...link.fragments].join("#")}]]`
    if (seen.has(written)) continue
    if (wikilinkPath(names, claims, from, link.target) !== null) continue
    seen.add(written)
    found.push({ written, resolved: link.target, suggest: wikilinkSuggestions(names, claims, link.target) })
  }
  return found
}

export const deadLinksOf = (names: Names, at: Located): ReadonlyArray<DeadLink> => {
  if (isMirror(at.node)) return []
  const said = recordRead(at.node)
  return deadLinksIn(names, at.file, said.desc === null ? [said.title] : [said.title, said.desc])
}

/** Whether a dead link was written as a wikilink rather than as a path. */
const isWikilink = (link: DeadLink): boolean => link.written.startsWith("[[") || link.written.startsWith("![[")

export const deadLinkSaid = (link: DeadLink): string =>
  (isWikilink(link)
    ? `no file is named ${link.resolved}`
    : `link resolves to nothing served: ${link.resolved}`) +
  (link.suggest.length === 0 ? "." : ` — did you mean ${link.suggest.map(path => `\`${path}\``).join(" or ")}?`)

export const deadLinkFields = (links: ReadonlyArray<DeadLink>): { readonly deadLinks?: ReadonlyArray<DeadLink> } =>
  links.length === 0 ? {} : { deadLinks: links }
