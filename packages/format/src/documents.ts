/**
 * Documents: the `.md` files a served directory holds, what a node's `doc`
 * points at, and what a document is allowed to point at in turn.
 *
 * A document is CONTENT, not structure. Its text is carried in the set beside
 * the nodes (see {@link ./set.ts}) for the same reason a note's `desc` is
 * carried on the record: it is markdown stored verbatim and interpreted only
 * at view time, so the reader that draws it and the validator that checks the
 * reference to it are looking at one snapshot of the directory rather than at
 * two reads that could disagree.
 *
 * Three rules live here and nowhere else:
 *
 *   - {@link docOf} — where a node's `doc` lands. Relative to the DEFINING
 *     outline's own directory, which is what "attached" means: a node names a
 *     file beside itself, not beside whoever is reading it.
 *   - {@link resolveRelative} — the path arithmetic that answers it, with no
 *     filesystem access at all. Both sides are already paths relative to the
 *     served directory, and a rule that touched the disk would be a second
 *     reader of it.
 *   - {@link pictureOf} and {@link isPicture} — what a relative `![](…)` may
 *     name. Two layers ask it (the renderer that rewrites a relative `src` into
 *     a URL, and the route that answers that URL), they are in packages that
 *     cannot import each other, and two allowlists that drifted apart would
 *     mean either a broken image or a served file nobody meant to serve.
 *   - {@link isAsset} — what the ROUTE may answer at all, which is the same
 *     question asked once more and one step wider: a previewed `.html` is
 *     fetched by URL now, so the page itself and the parts it draws with are
 *     addresses too. Markdown's rule is untouched by that; a relative
 *     `![](…)` still names a picture or nothing.
 *   - {@link bodiedOf} — where a relative `[…](…)` lands. The same arithmetic
 *     as a `doc` and as a picture, asked about the third thing markdown can
 *     point at: another file of this directory that has a page.
 */

import { Schema } from "effect"

import { bodyKind, fileKind } from "./kinds.ts"
import { isMirror, type Located } from "./node.ts"

/**
 * One BODIED file of the set: its path, and its text.
 *
 * A `.md`, or a `.html` beside it — one shape for both, because what the set
 * knows about either is the same two facts, and WHICH it is, is the name's own
 * answer (`./kinds.ts`) rather than a tag here that could disagree with it. The
 * type keeps the name `Document` because it is the wire's: it is the schema of
 * the `documents` collection an MCP client already addresses by URI, and a
 * rename would break an external contract to relabel a field.
 *
 * The TEXT is part of the SET, and that is the decision this field records. A
 * document is read by the same probe, cached against the same stamp and
 * published in the same revision as every outline, so an edit reaches an open
 * page through the machinery that was already there — no second read path and
 * no fetch to invalidate — and there is exactly one answer to "what does this
 * directory say right now".
 *
 * What that does NOT decide is when a body crosses a wire. A transport serving
 * a directory of thousands of files cannot put every one of them in a
 * first frame, and olai's does not: `@olai/surface` publishes the documents as
 * a collection read one key at a time. This type is what the validator and the
 * view are handed, which is the whole loaded set, because a `doc` reference has
 * to be checkable against what is actually served.
 */
export const Document = Schema.Struct({
  file: Schema.String,
  /** Verbatim, exactly as on disk. Markdown is interpreted at view time. */
  text: Schema.String,
})
export type Document = typeof Document.Type

/** The document this node attaches, as a path relative to the served
 *  directory — or `undefined` for a node that attaches none. A mirror never
 *  does: it is a second placement of a node, and the node itself is where every
 *  field describing it lives. */
export const docOf = (located: Located): string | undefined =>
  isMirror(located.node) || located.node.doc === undefined
    ? undefined
    : resolveRelative(located.file, located.node.doc)

/** Join `to` onto the directory of `from`, collapsing `.` and `..`. A `..` that
 *  would climb above the served directory is dropped rather than escaping it:
 *  there is nothing up there to name, and every caller matches the answer
 *  against files that were actually found. */
export const resolveRelative = (from: string, to: string): string => {
  const segments = from.split("/").slice(0, -1)
  for (const segment of to.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") segments.pop()
    else segments.push(segment)
  }
  return segments.join("/")
}

/**
 * The picture a markdown `![](…)` names, as a path relative to the served
 * directory — or `null` for a source this app does not draw at all.
 *
 * `from` is the file the markdown was written in: the outline, for a note; the
 * document itself, for a document. So a picture is resolved beside the text
 * that names it, exactly as `doc` is.
 *
 * Only a RELATIVE path to a picture survives: the address rule is
 * {@link relativeTo}'s, and the extension allowlist is this one's. A page that
 * fetched a remote image would be a page that told a third party what someone
 * is reading, and an address off the allowlist is a way of drawing something
 * that is not a file in this directory.
 */
export const pictureOf = (from: string, src: string): string | null => {
  const resolved = relativeTo(from, src)
  return resolved !== null && isPicture(resolved) ? resolved : null
}

/**
 * The file under the served directory a markdown address names, before anyone
 * asks WHAT KIND of file it has to be — or `null` for an address this app does
 * not resolve at all.
 *
 * The refusals live here, once, because there are two sinks and they are two
 * different things: a picture becomes a `/media/…` URL the server answers, a
 * link becomes a `/doc/…` route the client opens. A refusal added to one of
 * them and not the other would be a widening nobody meant — and the two lists
 * were character-for-character identical the moment there were two.
 *
 * No scheme (so no `http:`, no `data:`, no `javascript:`), no `//host`, no
 * absolute path, no bare fragment: everything on that list is either somewhere
 * else's business or a way of naming something that is not a file in this
 * directory. A `..` is not refused but CLAMPED by {@link resolveRelative}.
 */
const relativeTo = (from: string, to: string): string | null => {
  if (to === "" || to.startsWith("/") || to.startsWith("#")) return null
  if (SCHEME.test(to)) return null
  return resolveRelative(from, to)
}

/**
 * The file WITH A PAGE that a markdown `[…](…)` names, as a path relative to
 * the served directory — or `null` for a link that names none.
 *
 * The vault case, and the reason it exists: a directory of `.md` files links
 * between them with plain relative paths (`../projects/deck.md`), and a
 * renderer that left those alone would hand the browser an address relative to
 * whatever ROUTE the page happens to be at — which is the document's own
 * directory on `/doc/…` by luck, and the wrong place everywhere else. Resolved
 * here instead, beside the file the link was WRITTEN in, exactly as a `doc`
 * field and a relative picture already are.
 *
 * The same address rule as {@link pictureOf} — one {@link relativeTo} between
 * them — and a different question at the end of it: a file whose content is a
 * BODY ({@link bodyKind}), so `README` and `art/handle.png` are not, and a
 * `.md` or a `.html` anywhere under the root is. It is the registry's question
 * rather than "is it a document" because the answer it decides is whether the
 * app has a page to open, and that is exactly what a body means — a link to a
 * saved `report.html` beside the notes is one a reader can follow now, and it
 * used to be a full page load to an address resolved against whatever they were
 * reading.
 *
 * Whether the directory actually HOLDS the answer is not asked here, and that
 * is deliberate: this package knows the arithmetic, the page model knows what
 * was found, and a link to a file that is not there is answered by the screen
 * that says so rather than by a link that silently was not one.
 */
export const bodiedOf = (from: string, href: string): string | null => {
  const resolved = relativeTo(from, href)
  return resolved !== null && bodyKind(resolved) !== null ? resolved : null
}

/** A URL scheme, or the `//host` that borrows the page's own. Tested before
 *  resolution, because a `:` is a character a path resolver would happily
 *  treat as part of a file name. */
const SCHEME = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/

/**
 * The extensions a picture may have.
 *
 * Pictures are the one thing under the served directory that is neither an
 * outline nor a document: nothing loads them, nothing validates them, and they
 * exist only as the target of a relative `![](…)`. So the list is a closed
 * allowlist rather than "not an outline" — `.svg` is deliberately absent,
 * because an SVG is a document that can script, and the outlines themselves
 * are not pictures.
 */
export const PICTURE_EXTENSIONS: ReadonlyArray<string> = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".ico",
]

export const isPicture = (path: string): boolean => {
  const lower = path.toLowerCase()
  return PICTURE_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

/**
 * The extensions a PAGE may fetch, beyond the pictures above — the parts a
 * saved `.html` is made of.
 *
 * A second allowlist rather than a widening of the first, because the two
 * answer different questions and only one of them is markdown's. A relative
 * `![](…)` may name a picture and nothing else; that rule is unchanged and
 * {@link isPicture} is still the whole of it. What is new is that a previewed
 * `.html` is now fetched BY URL and draws itself with its own parts — the
 * stylesheet it was saved beside, the script it was built with, the font it
 * embeds — and a preview that drew a page's pictures but refused its
 * stylesheet would be a rule nobody could explain.
 *
 * A CLOSED LIST, and what is missing from it is the argument. `.svg` stays out
 * for the reason it is out of the pictures: an SVG is a document that can
 * script, and a page may pull one into a frame rather than an `<img>`. Data
 * (`.json`, `.csv`) stays out because a page reading data is a page reading
 * FILES, which is a different permission from a page drawing itself, and
 * nothing forced the question yet. Everything the set itself is made of —
 * `.olai`, `.md` — stays out because those already have a page of their own,
 * and a route that also handed them over raw would be a second way to read
 * them with no argument for the first.
 *
 * The `.html` itself is NOT here: which suffix is hypertext is `./kinds.ts`'s
 * single answer, and {@link isAsset} asks it there.
 */
export const ASSET_EXTENSIONS: ReadonlyArray<string> = [
  ".css",
  ".js",
  ".mjs",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
]

/**
 * Whether a served path is something a previewed page may fetch: the page
 * itself, its pictures, or one of its parts.
 *
 * The one predicate the media route judges a request by, and the reason it is
 * here rather than at the route: it is a statement about what a suffix MEANS,
 * which is this package's business, and the route is in a package the client
 * cannot import (`@olai/surface` carries the URL shape, `@olai/server`
 * answers it).
 */
export const isAsset = (path: string): boolean => {
  if (fileKind(path) === "hypertext") return true
  if (isPicture(path)) return true
  const lower = path.toLowerCase()
  return ASSET_EXTENSIONS.some((extension) => lower.endsWith(extension))
}
