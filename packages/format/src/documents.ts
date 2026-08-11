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
 */

import { Schema } from "effect"

import { isMirror, type Located } from "./node.ts"

/**
 * One `.md` of the set: its path, and its text.
 *
 * The TEXT is part of the SET, and that is the decision this field records. A
 * document is read by the same probe, cached against the same stamp and
 * published in the same revision as every outline, so an edit reaches an open
 * page through the machinery that was already there — no second read path and
 * no fetch to invalidate — and there is exactly one answer to "what does this
 * directory say right now".
 *
 * What that does NOT decide is when a body crosses a wire. A transport serving
 * a directory of thousands of `.md` files cannot put every one of them in a
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
 * Only a RELATIVE path to a picture survives. No scheme (so no `http:`, no
 * `data:`, no `javascript:`), no `//host`, no absolute path, and no extension
 * off the allowlist — a page that fetched a remote image would be a page that
 * told a third party what someone is reading, and everything else on that list
 * is a way of drawing something that is not a file in this directory. A `..`
 * is not refused but CLAMPED by {@link resolveRelative}: a shared picture
 * folder beside the documents is a real arrangement, and the result is under
 * the served root by construction.
 */
export const pictureOf = (from: string, src: string): string | null => {
  if (src === "" || src.startsWith("/") || src.startsWith("#")) return null
  if (SCHEME.test(src)) return null
  const resolved = resolveRelative(from, src)
  return isPicture(resolved) ? resolved : null
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
