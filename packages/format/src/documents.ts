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
 * A DOCUMENT's text is part of the SET, and that is the decision this field
 * records. It is read by the same probe, cached against the same stamp and
 * published in the same revision as every outline, so an edit reaches an open
 * page through the machinery that was already there — no second read path and
 * no fetch to invalidate — and there is exactly one answer to "what does this
 * directory say right now".
 *
 * HYPERTEXT's is `null`, and that is the other decision it records: the set
 * keeps the path and not the body (`./kinds.ts`'s `kept`, which owns the
 * argument). A `.html` is the one file olai only shows — nothing validates it,
 * no op writes it — so the set never needed its bytes, while a vault of saved
 * pages made them the largest thing in the process. The body is read when a
 * reader opens the file and is kept by nobody.
 *
 * `null` is therefore a STATE and not an absence, the way the manifest's is
 * (`@olai/surface`): "this file is served, and its body is not here". An
 * unreadable file is a different answer again — it is in `broken`, and
 * `writable` (`@olai/ops`) refuses to write over what the set could not read.
 *
 * What none of that decides is when a body crosses a wire. A transport serving
 * a directory of thousands of files cannot put every one of them in a
 * first frame, and olai's does not: `@olai/surface` publishes the documents as
 * a collection read one key at a time. This type is what the validator and the
 * view are handed, which is the whole loaded set, because a `doc` reference has
 * to be checkable against what is actually served — and checking one needs the
 * PATHS, which is the half of this the set still holds for every bodied file.
 */
export const Document = Schema.Struct({
  file: Schema.String,
  /** Verbatim, exactly as on disk — or `null` for a body the set does not keep
   *  (see above). Markdown is interpreted at view time. */
  text: Schema.NullOr(Schema.String),
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

/** Whether a path ends in one of these suffixes, case-folded — the matching
 *  RULE, held once for the two lists below it. Case-folding, exact suffix, no
 *  dot boundary: two allowlists answering the same shape of question should not
 *  be two chances to refine one of them and not the other. */
const suffixed = (path: string, extensions: ReadonlyArray<string>): boolean => {
  const lower = path.toLowerCase()
  return extensions.some((extension) => lower.endsWith(extension))
}

export const isPicture = (path: string): boolean => suffixed(path, PICTURE_EXTENSIONS)

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
 *
 * Module-private, unlike {@link PICTURE_EXTENSIONS} beside it, because nothing
 * outside needs the LIST — the route asks {@link isAsset} a question and gets a
 * yes or a no. A second exported list would be a second thing to keep in step
 * for no reader.
 */
const ASSET_EXTENSIONS: ReadonlyArray<string> = [
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
export const isAsset = (path: string): boolean =>
  fileKind(path) === "hypertext" || isPicture(path) || suffixed(path, ASSET_EXTENSIONS)

/**
 * WHICH of the set's bodied files are DOCUMENTS.
 *
 * The set carries one list for every file it keeps a body for, because what it
 * knows about either kind is the same two facts ({@link Document}) — and every
 * consumer of that list then wants the `.md` half of it, because a `.html` is
 * the one file olai only shows: nothing validates it, no op writes it, and the
 * set keeps its path without its bytes.
 *
 * FOUR CALLERS ASKED THIS, each with its own `.filter`: the validator deciding
 * what a node's `doc` may point at, the planner refusing a `write_document`,
 * and both document reads. Four spellings of one rule is four places for it to
 * come to disagree — and the failure mode is not a crash but a quiet
 * disagreement about what a served directory contains, which is exactly the
 * class of bug `kinds.ts` was centralised to end. It is here rather than
 * beside any of them because it is a statement about what a document IS, which
 * is this module's whole subject.
 */
export const documentsIn = (
  bodied: ReadonlyArray<Document>,
): ReadonlyArray<Document> => bodied.filter((entry) => fileKind(entry.file) === "document")

/**
 * ONE of them, by the path a caller named — or `undefined` for a path the set
 * does not serve as a document, whether because nothing is there or because
 * what is there is a `.html`.
 *
 * The KIND is asked of the requested path FIRST, so the walk over the set only
 * happens for a path that could be one. That is not a micro-optimisation kept
 * for its own sake: it is what makes the two callers — a write's refusal and a
 * read's — walk the list on the same terms, which is the property that lets
 * them answer one typo with one sentence.
 */
export const documentIn = (
  bodied: ReadonlyArray<Document>,
  file: string,
): Document | undefined =>
  fileKind(file) === "document" ? bodied.find((entry) => entry.file === file) : undefined

/**
 * A document, in one line: its first line with anything on it, heading marks
 * off.
 *
 * The closest thing a `.md` has to a title, and it is a DERIVATION rather than
 * a field — a document has no record, so there is nowhere on it for a name to
 * be written. `# Finishes` is a document called Finishes, and the hashes are
 * markup rather than the name.
 *
 * PLAIN TEXT, never rendered markdown, because both callers put it in a space
 * one line high: the web draws it in a row beside a `doc`-carrying node's
 * title, and `list_documents` puts it in a listing beside the path. A heading,
 * a list or a fenced block drawn there would be a document pretending to be a
 * row.
 *
 * IT IS THE FORMAT'S because two faces ask it now. It was `@olai/web`'s
 * `document/preview.ts` while the browser was the only thing that named a
 * document, and the rule moved here whole when the agent's listing wanted the
 * same answer — "MCP and Web ops must be consistent" (HACKING.md) is a
 * property of there being one function, not of two that were written from each
 * other.
 */
export const firstLine = (text: string): string => {
  // Scanned rather than split: a preview reads the top of a document, and
  // `split("\n")` would allocate every line of one to throw all but the first
  // away — on a page that draws this beside every `doc`-carrying row, and in a
  // listing that draws it once per served document.
  let at = 0
  while (at < text.length) {
    const end = text.indexOf("\n", at)
    const line = (end === -1 ? text.slice(at) : text.slice(at, end)).trim()
    if (line !== "") {
      // Only the heading marks, and only where markdown puts them: leading
      // `#`s, and the optional closing run of them. Everything else stays as
      // written — stripping emphasis and links here would be a second, worse
      // renderer.
      const stripped = line.replace(/^#{1,6}\s+/, "").replace(/\s+#+$/, "")
      return stripped === "" ? line : stripped
    }
    if (end === -1) break
    at = end + 1
  }
  return ""
}

/** One encoder for the process, because `bytesOf` is called once per served
 *  document and constructing one per call is the only avoidable cost here. */
const UTF8 = new TextEncoder()

/**
 * What a document's text WEIGHS, in bytes, as UTF-8 on disk.
 *
 * Beside {@link firstLine} because it is the same kind of fact — the two things
 * that can be said about a document without reading it, and the two a listing
 * carries. What a caller does with it is decide whether to ask for the whole
 * of it.
 *
 * BYTES rather than `text.length`, which is UTF-16 units and would report a
 * different number than every other tool a person has for the same file. This
 * was fifteen lines of code-unit arithmetic — the same count without the
 * transient buffer — and the buffer is the better trade: a surrogate-pair
 * branch and a lone-surrogate rule are exactly the kind of thing that is
 * subtly wrong for years, and `TextEncoder` is the runtime's own answer.
 * `Buffer.byteLength` is the other one-liner and is not available to this
 * package, which runs in a browser as readily as in a server.
 *
 * WHAT IT COSTS, stated because this package argues about wire cost
 * everywhere else: a listing is O(the bytes of every served `.md`), where
 * {@link ./set.ts}'s outline listing is O(nodes). That is a cost class up, and
 * it is accepted for now because it is an agent's occasional call over bodies
 * the process is already holding — not a render, not a keystroke, not a
 * subscription. The cheaper form exists if it ever matters and is one layer
 * down: `@olai/store` decodes each file and throws away the byte count the
 * read already had, so carrying it onto {@link Document} would make this
 * O(documents) and delete the question.
 */
export const bytesOf = (text: string): number => UTF8.encode(text).length
