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

import { type Address, addressOf, printAddress } from "./address.ts"
import { bodyKind, fileKind } from "./kinds.ts"
import { headingText } from "./slug.ts"
import { isMirror, type Located } from "./node.ts"

/**
 * WHAT WAS HERE, and where it went: a `Document` of `{file, text}` — the whole
 * of what the set knew about a `.md` or a `.html`, and the reason no feature
 * could name anything inside one. It is `./document.ts`'s sum now, with a face
 * on every arm, and the set serves that as its one collection; the two lookups
 * that stood beside it (`documentsIn`, `documentIn`, each a `.filter` over the
 * bodied half) are narrowings of that collection (`./set.ts`).
 *
 * What stays in this module is the ARITHMETIC — where a `doc` lands, where a
 * relative `![](…)` and `[…](…)` land, what a page may fetch, what a body's
 * first line says. Those are statements about what a document may POINT AT and
 * what can be read off one without parsing it, which is this file's subject
 * and not the sum's.
 */

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
 * link becomes the document's own address, which the client opens. A refusal added to one of
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
 * directory by luck, and the wrong place everywhere else. Resolved
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
      // Only the heading marks, and only where markdown puts them — which is
      // `./slug.ts`'s own rule, asked rather than spelled again: what a
      // heading's WORDS are is one question, and this file and the face's
      // element list were taking the marks off with two patterns that were
      // free to take different numbers of characters. Everything else stays as
      // written — stripping emphasis and links here would be a second, worse
      // renderer.
      const stripped = headingText(line)
      return stripped === null || stripped === "" ? line : stripped
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
 * IT MEASURES THE TEXT, not the file, and those part company for a `.md`
 * that is not valid UTF-8: the store decodes leniently, so bytes it could not
 * read are already replacement characters by the time this counts them, and
 * the answer can exceed the file's size on disk. That is the RIGHT number for
 * what this field is for — it matches the text `read_document` hands over and
 * the text `write_document`'s `was` is compared against — and it is the same
 * deferral as below: the store knows the real one and throws it away.
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

/**
 * EVERY ADDRESS A PIECE OF PROSE POINTS AT, in the order it writes them and
 * never twice.
 *
 * `from` is the file the markdown was WRITTEN in — a document for its own
 * body, the defining outline for a node's note — because that is what a
 * relative link is relative to, exactly as {@link docOf} and {@link pictureOf}
 * already are. One rule for both, which is the point: a `[…](…)` in a note and
 * a `[…](…)` in a document mean the same thing, and a face that read one of
 * them differently would be the parity hole this round exists to close.
 *
 * The three things a link here can name are the three the address grammar has:
 *
 *   - `../projects/deck.md` — another document of this directory, resolved
 *     beside the file the link was written in ({@link bodiedOf}, whose refusals
 *     are this function's refusals).
 *   - `notes/README.md#install` — a heading inside one. The fragment is cut off
 *     BEFORE the path is resolved, because `#` is the grammar's punctuation and
 *     `README.md#install` is not a filename.
 *   - `#a1b2c3` — a node, wherever it lives. It is the one link with no
 *     document half, and {@link bodiedOf} refuses it (there is no file there to
 *     resolve), so it is read straight as the address it is.
 *
 * A SCAN, NOT A PARSE, and the boundary is worth naming: this package holds no
 * markdown parser and deliberately does not gain one here (`./derive.ts` makes
 * the same refusal about tags, for the same reason — it is the floor the write
 * gate stands on). So a `[…](…)` inside a fenced code block is a link to this
 * function and is drawn as text by the browser. That direction is the safe one:
 * the cost is a backlink nobody wrote, never a page that will not render.
 *
 * NEVER TWICE, and the container says so: a note that links the same document
 * three times points at it once. What reads this wants the EDGES.
 */
export const linksIn = (from: string, text: string): ReadonlyArray<Address> => {
  // The cheap negative first: nearly every note in a directory holds no link
  // at all, and this is asked of every record and every body of the set.
  if (!text.includes("](")) return NO_LINKS
  let found: Array<Address> | undefined
  let seen: Set<string> | undefined
  for (const href of writtenLinks(text)) {
    const address = linkTo(from, href)
    if (address === null) continue
    const written = printAddress(address)
    if ((seen ??= new Set()).has(written)) continue
    seen.add(written)
    ;(found ??= []).push(address)
  }
  return found ?? NO_LINKS
}

/**
 * The TARGET of every inline markdown link in a piece of prose, in the order
 * they are written — a bracketed label, then a parenthesised address.
 *
 * ONE FORWARD SCAN, and that is a correctness decision rather than a taste one.
 * The pattern this replaces (`/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g`) is
 * quadratic on prose somebody else wrote — CodeQL's `js/polynomial-redos` —
 * because the label's `[^\]]*` restarts at every `[` of a line full of them
 * and scans to the end each time. This is run over every body of a served
 * directory and every note in it, which is exactly the input that is not
 * this app's to trust.
 *
 * The scan keeps the same reading the pattern had: the label may not hold a
 * `]`, the target may hold no whitespace (what follows a space is markdown's
 * optional title, which is dropped), and a link whose target is written in
 * angle brackets is not read — that is the spelling for a filename with a
 * space in it, and unwrapping them would be a scan pretending to be a parser.
 */
const writtenLinks = (text: string): ReadonlyArray<string> => {
  const found: Array<string> = []
  let label = -1
  for (let at = 0; at < text.length; at++) {
    const char = text[at]
    if (char === "[") label = at
    else if (char === "]") {
      if (label !== -1 && text[at + 1] === "(") {
        const close = text.indexOf(")", at + 2)
        if (close !== -1) {
          const target = text.slice(at + 2, close)
          // What a space opens is markdown's optional title, and what it cannot
          // be is part of the address.
          const space = target.search(SPACE)
          found.push(space === -1 ? target : target.slice(0, space))
          at = close
        }
      }
      label = -1
    }
  }
  return found
}

/** Where a written target stops. A single class rather than a repetition, so
 *  the search is one pass over the characters between the parentheses. */
const SPACE = /\s/

/** The answer for prose that points nowhere, which is most of it: ONE list,
 *  shared, as `./derive.ts` shares its own. */
const NO_LINKS: ReadonlyArray<Address> = []

/** What one written link names, or `null` — the grammar's three arms, told
 *  apart by where the `#` is. */
const linkTo = (from: string, href: string): Address | null => {
  const cut = href.indexOf("#")
  if (cut === 0) return addressOf(null, href.slice(1))
  const path = cut === -1 ? href : href.slice(0, cut)
  const resolved = bodiedOf(from, path)
  return resolved === null ? null : addressOf(resolved, cut === -1 ? null : href.slice(cut + 1))
}
