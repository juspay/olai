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

/** Scan fields independently: a title and note cannot complete each other's Markdown. */
export const deadLinksIn = (from: string, text: string | ReadonlyArray<string>, served: ReadonlySet<string>): ReadonlyArray<DeadLink> => {
  const found: DeadLink[] = []
  const seen = new Set<string>()
  for (const written of (typeof text === "string" ? writtenLinks(text) : text.flatMap(writtenLinks))) {
    const cut = written.indexOf("#")
    const resolved = pathedOf(from, cut === -1 ? written : written.slice(0, cut))
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
