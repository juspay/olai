/** Missing relative targets are a reading of a revision, never a verdict. */
import { Schema } from "effect"
import type { Read } from "@olai/prose/read.ts"
import { wikilinkWritten } from "@olai/prose/wikilink.ts"
import { recordRead } from "../kept.ts"
import { standardLanding, wikilinkLanding } from "../links/landing.ts"
import type { Names } from "../links/names.ts"
import { relativeFrom } from "../links/paths.ts"
import { wikilinkSuggestions } from "../links/wikilink.ts"
import { isMirror, type Located } from "../node.ts"
import { basenameOf } from "../paths.ts"
import { nearestId } from "../suggest.ts"

/** A link that finds nothing: how it was written, the `path` it resolved to or
 *  the `name` it looked for, and what it may have meant. */
export const DeadLink = Schema.Struct({
  kind: Schema.Literals(["path", "name"]),
  written: Schema.String,
  resolved: Schema.String,
  suggest: Schema.Array(Schema.String),
})
export type DeadLink = typeof DeadLink.Type

/**
 * The dead links of some readings — each text's own (`@olai/prose`'s `read`),
 * so a title and a note cannot complete each other's Markdown, and code, a
 * comment or an escape holds no link. `names` is the membership they are read
 * against — a revision's own (`Reading.names`), or one a planned write builds
 * for the files it adds.
 *
 * Each link is asked where it lands (`./links/landing.ts`), the question the
 * page asks too. A standard link that looked for a path is dead of kind
 * `path`, reported as written with the path it resolved to; a wikilink that
 * looked for a name is dead of kind `name`, reported written as a wikilink
 * with the name it looked for, and what it suggests is written as a wikilink
 * too. A link to a heading of the writer itself names no file and is never
 * dead.
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
    const landing = standardLanding(claims, served, from, link)
    if (landing === null || !("lookedFor" in landing) || seen.has(link.url)) continue
    seen.add(link.url)
    const resolved = landing.lookedFor
    const candidates = [...served].filter(path => basenameOf(path) === basenameOf(resolved))
    const nearest = candidates.length === 0 ? nearestId(resolved, served) : null
    if (nearest !== null) candidates.push(nearest)
    found.push({ kind: "path", written: link.url, resolved, suggest: candidates.map(path => relativeFrom(from, path)) })
  }
  for (const link of reads.flatMap((said) => said.wikilinks)) {
    const written = wikilinkWritten(link, { embed: link.embed })
    if (seen.has(written)) continue
    const landing = wikilinkLanding(names, claims, from, link)
    if (landing === null || !("lookedFor" in landing)) continue
    seen.add(written)
    found.push({ kind: "name", written, resolved: landing.lookedFor, suggest: wikilinkSuggestions(names, claims, link.target) })
  }
  return found
}

export const deadLinksOf = (names: Names, at: Located): ReadonlyArray<DeadLink> => {
  if (isMirror(at.node)) return []
  const said = recordRead(at.node)
  return deadLinksIn(names, at.file, said.desc === null ? [said.title] : [said.title, said.desc])
}

export const deadLinkSaid = (link: Pick<DeadLink, "kind" | "resolved" | "suggest">): string =>
  (link.kind === "name"
    ? `no file is named ${link.resolved}`
    : `link resolves to nothing served: ${link.resolved}`) +
  (link.suggest.length === 0 ? "." : ` — did you mean ${link.suggest.map(path => `\`${path}\``).join(" or ")}?`)

export const deadLinkFields = (links: ReadonlyArray<DeadLink>): { readonly deadLinks?: ReadonlyArray<DeadLink> } =>
  links.length === 0 ? {} : { deadLinks: links }
