/** Relative links, pictures and the forward references of a record or body.
 * Resolution is beside the writing file and independent of served membership;
 * dead-links.ts asks that separate question against a revision's paths.
 */
import { type Address, addressOf, printAddress } from "./address.ts"
import { proseIn } from "./frontmatter.ts"
import { bodyKind, type Claims, isFetched } from "./kinds.ts"
import { isMirror, type Located } from "./node.ts"
import { headingText } from "./slug.ts"

/**
 * WHAT WAS HERE, and where it went: a `Document` of `{file, text}` — the whole
 * of what the set knew about a `.md` or a `.html`, and the reason no feature
 * could name anything inside one. It is `./document.ts`'s sum now, with a face
 * on every arm, and the set serves that as its one collection; the two lookups
 * that stood beside it (`documentsIn`, `documentIn`, each a `.filter` over the
 * bodied half) are `markdownIn` and `markdownAt` over that collection
 * (`./set.ts`).
 *
 * What stays in this module is WHERE A REFERENCE LANDS, and it is one subject
 * read at three grains: the arithmetic (where a relative `![](…)` and
 * a relative `[…](…)` resolve to), the refusals (what a page may fetch at all),
 * and the two readings built out of those — {@link linksIn}, every address a
 * piece of PROSE points at, and {@link recordLinks}, every address one RECORD
 * points at.
 *
 * THOSE TWO SIT TOGETHER on purpose, and it is the one thing this file gained
 * when the sum arrived. `./document.ts` is the TYPE and its constructors; what
 * points at what is this file's question, asked of a body and of a record with
 * the same rule underneath, and read forwards to build a face and backwards to
 * say who points at a document (`./backlinks.ts`). Split across the two
 * modules they would have been two answers to one question.
 */

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
 * that names it, just like a note link.
 *
 * Only a RELATIVE path to a picture survives: the address rule is
 * {@link relativeTo}'s, and the extension allowlist is this one's. A page that
 * fetched a remote image would be a page that told a third party what someone
 * is reading, and an address off the allowlist is a way of drawing something
 * that is not a file in this directory.
 */
export const pictureOf = (claims: Claims, from: string, src: string): string | null => {
  const resolved = relativeTo(from, src)
  return resolved !== null && isPicture(claims, resolved) ? resolved : null
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
 *
 * A `%20` is a space in the filename, not a filename that contains a percent
 * sign. Markdown's portable spelling of a space in a destination is the
 * encoding, and the parser writes it into the href; decoding HERE — once,
 * per segment, the way a written address is read — is what stops the page
 * printer from encoding the percent again.
 */
const relativeTo = (from: string, to: string): string | null => {
  if (refusedHref(to)) return null
  const decoded = decodeHref(to)
  if (decoded === null || (decoded !== to && refusedHref(decoded))) return null
  return resolveRelative(from, decoded)
}

/** The refusals {@link relativeTo} applies to the href as written and again
 *  after decoding, so `%2Fetc/passwd.md` cannot sneak past as a relative path. */
const refusedHref = (href: string): boolean =>
  href === "" || href.startsWith("/") || href.startsWith("#") || SCHEME.test(href)

/**
 * Percent-decode one path, per segment — or `null` for an escape nothing
 * could have written. Per segment so `%2F` is a slash in a name rather than
 * a separator, matching how a written address is read.
 */
const decodeHref = (href: string): string | null => {
  if (!href.includes("%")) return href
  const segments = href.split("/").map(decodedSegment)
  return segments.includes(null) ? null : segments.join("/")
}

const decodedSegment = (segment: string): string | null => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}


/**
 * The path in this directory that a relative reference names, whatever suffix
 * it turns out to have — or `null` for a string that names no path at all.
 *
 * THE SIBLING of {@link pictureOf}, and the one that asks less rather than
 * more. The picture rule ends at an allowlist because its caller cannot ask
 * the directory: a markdown renderer rewrites an `href` without knowing what
 * the vault holds, so "is this a picture" has to be answered from the name.
 * THIS one's caller can ask — a property value becomes a link only where the
 * tab is holding the path in its file list (`@olai/web`'s `props/door.ts`) —
 * and existence is a stronger answer than any suffix rule: it lets an `.olai`
 * be named, which `bodyKind` refuses because an outline is a tree rather than
 * a body, and it refuses a `.md` the directory has not got, which a rendered
 * link would otherwise rewrite for a page the vault does not have.
 *
 * WHAT IT STILL OWNS is the half that is not the suffix, and it is the half
 * that matters: {@link relativeTo}'s refusals — no scheme, no `//host`, no
 * absolute path, no bare fragment — and {@link resolveRelative}'s clamping of
 * `..` to the served root. Those are one spelling for both of these, which
 * is exactly the arrangement the paragraph above {@link relativeTo} is
 * written to keep.
 */
export const pathedOf = (from: string, href: string): string | null =>
  relativeTo(from, href)

/** A URL scheme, or the `//host` that borrows the page's own. Tested before
 *  resolution, because a `:` is a character a path resolver would happily
 *  treat as part of a file name. */
const SCHEME = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/

/** Whether a path ends in one of these suffixes, case-folded — the matching
 *  RULE, held once for the two lists below it. Case-folding, exact suffix, no
 *  dot boundary: two allowlists answering the same shape of question should not
 *  be two chances to refine one of them and not the other. */
const suffixed = (path: string, extensions: ReadonlyArray<string>): boolean => {
  const lower = path.toLowerCase()
  return extensions.some((extension) => lower.endsWith(extension))
}

/**
 * Whether Markdown may draw this path as an inline picture.
 *
 * READ OFF THE CLAIMS: `picture` admits the case-folded suffix, and `inert`
 * excludes suffixes that must not become inline pictures. A picture used to
 * be the one thing under the served directory that was neither an outline nor a document — nothing loaded one,
 * nothing validated one, and one existed only as the target of a relative
 * `![](…)` — so this was a closed allowlist typed out here. A picture is a
 * KIND now (`./kinds.ts`): it is in the set, it is in the sidebar, and it has a
 * page. Two hand-kept lists of the same suffixes would be two chances to add
 * `.heic` to one of them, and the way that reads is a file the sidebar draws
 * and a document cannot point at, or the reverse.
 *
 * The image row declares `.svg` inert, preserving the ruling
 * (`@olai/surface`'s `attach.ts` keeps the same one for what may be handed to
 * an agent): an SVG is a document that can script, and markdown pointing at one
 * is this app promising to draw a file it has not read. That the kind claims
 * `.svg` is not the same permission — a picture's PAGE draws it in an `<img>`,
 * which is the element that will not run it, and the response it is fetched
 * with says so too (the vault's `http/media.ts`).
 */
export const isPicture = (claims: Claims, path: string): boolean => {
  const lower = path.toLowerCase()
  return [...claims.byKind.values()].some(claim => claim.picture === true &&
    suffixed(lower, claim.exts) && !suffixed(lower, claim.inert ?? []))
}

/** Serving policy comes from the current claim, including case-folded images. */
export const servingOf = (claims: Claims, path: string): { sealed: boolean; inert: boolean } => {
  const claim = [...claims.byKind.values()].find(claim =>
    claim.exts.some(ext => path.endsWith(ext) || (claim.picture === true && path.toLowerCase().endsWith(ext))))
  return { sealed: claim?.serving === "sealed-frame", inert: suffixed(path, claim?.inert ?? []) }
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
 * A CLOSED LIST, and what is missing from it is the argument. Data (`.json`,
 * `.csv`) stays out because a page reading data is a page reading FILES, which
 * is a different permission from a page drawing itself, and nothing has forced
 * the question — a `.csv` being a KIND now did not force it either, since that
 * kind's own page is handed the text over the wire and never fetches this
 * route. Everything the set itself is made of — `.olai`, `.md` — stays out
 * because those already have a page of their own, and a route that also handed
 * them over raw would be a second way to read them with no argument for the
 * first.
 *
 * `.svg` USED TO BE HERE AS AN ABSENCE and is now the registry's business: it
 * is one of the picture kind's suffixes, so {@link isAsset} admits it below,
 * and what stops a previewed page pulling one into a frame and running it is
 * the response that answers it rather than a suffix withheld here
 * (the vault's `http/media.ts` sandboxes an SVG's own response). Withholding
 * it here would also have withheld it from the `<img>` a picture's PAGE draws,
 * which is the one thing the ruling never meant to stop.
 *
 * The kinds a browser fetches are NOT here either: which suffixes those are is
 * `./kinds.ts`'s single answer, and {@link isAsset} asks it there.
 *
 * This companion-asset list is module-private because nothing outside needs
 * the LIST — the route asks {@link isAsset} a question and gets a
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
 * Whether a served path is something a browser may fetch: a file whose PAGE is
 * drawn by pointing at it, or one of the parts a saved page draws itself with.
 *
 * The one predicate the media route judges a request by, and the reason it is
 * here rather than at the route: it is a statement about what a suffix MEANS,
 * which is this package's business, and the route is in a package the client
 * cannot import (`@olai/surface` carries the URL shape, `@olai/server`
 * answers it).
 *
 * THE FIRST TERM IS THE REGISTRY'S COLUMN ({@link isFetched}) rather than a
 * kind named here, and that is what kept this predicate one line while the
 * viewers arrived: hypertext, a picture and a `.pdf` are drawn by a frame, an
 * `<img>` and an `<embed>` pointed at the file's own URL, and a `.csv` — text,
 * unkept, and still handed to its page over the wire — is not. Which of those
 * is which is one column of one table, not a list to keep in step over here.
 *
 * The SECOND term is not redundant with the first, and the difference is one
 * character of case: the registry matches a suffix exactly, so `SHOT.PNG` is a
 * file no kind claims, while {@link isPicture} has case-folded since before
 * there was a picture kind — and a document naming one has always drawn it.
 */
export const isAsset = (claims: Claims, path: string): boolean =>
  isFetched(claims, path) || isPicture(claims, path) || suffixed(path, ASSET_EXTENSIONS)

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
 * one line high: the web draws it in a row in a document listing, and `markdown_index` puts it in a listing beside the path. A heading,
 * a list or a fenced block drawn there would be a document pretending to be a
 * row.
 *
 * IT IS THE FORMAT'S because two faces ask it now. It was `@olai/web`'s
 * `document/preview.ts` while the browser was the only thing that named a
 * document, and the rule moved here whole when the agent's listing wanted the
 * same answer — "MCP and Web ops must be consistent" is a
 * property of there being one function, not of two that were written from each
 * other.
 */
export const firstLine = (text: string): string => {
  // FRONTMATTER IS NOT THE FIRST LINE, and asking {@link ./frontmatter.ts} is
  // how this knows: a `.md` that opens with a `---` block was called `---` in
  // the sidebar, in the palette and in every document listing, because
  // the literal first line with anything on it was the fence. The record on
  // top of a document is not what the document is CALLED — its first real line
  // is, exactly as it is for one with no record at all.
  const body = proseIn(text)
  // Scanned rather than split: a preview reads the top of a document, and
  // `split("\n")` would allocate every line of one to throw all but the first
  // away — on a page that draws this in every document listing, and in a
  // listing that draws it once per served document.
  let at = 0
  while (at < body.length) {
    const end = body.indexOf("\n", at)
    const line = (end === -1 ? body.slice(at) : body.slice(at, end)).trim()
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

/** One encoder for the process, because `bytesOf` is the definition of a
 *  document's weight and constructing one per call is the only avoidable cost
 *  here. Paid at decode ({@link ./document.ts}'s `bodiedDocument`), not per
 *  listing. */
const UTF8 = new TextEncoder()

/**
 * What a document's text WEIGHS, in bytes, as UTF-8 on disk.
 *
 * Beside {@link firstLine} because it is the same kind of fact — the two things
 * that can be said about a document without walking its markdown, and the two a
 * listing carries. What a caller does with it is decide whether to ask for the
 * whole of it.
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
 * what this field is for — it matches the text `markdown_read` hands over and
 * the text `markdown_write`'s `was` is compared against.
 *
 * PAID AT DECODE. {@link ./document.ts}'s `bodiedDocument` remembers the
 * answer on the document, so a listing is O(documents) rather than O(the bytes
 * of every served `.md`). This function stays the definition of the number —
 * the listing's test holds the remembered field to a recompute from the body,
 * including over multi-byte UTF-8, which is the case a UTF-16-unit count would
 * silently get wrong.
 */
export const bytesOf = (text: string): number => UTF8.encode(text).length

/**
 * BLOCK CONTEXT, LOCALLY — the lines that are a fenced or indented code block,
 * replaced with blank lines so the link scan below never sees inside one.
 *
 * List continuation indentation belongs to prose; four further spaces
 * introduce code within that item. Blank lines retain the list context.
 * Block context is local to this Markdown source, never shared across fields.
 */
const withoutCodeBlocks = (text: string): string => {
  let listIndent: number | undefined
  let fence: { marker: string; length: number } | undefined
  return text.split("\n").map(line => {
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
}

/**
 * INLINE CODE has its own delimiter rules, independent of block indentation —
 * the mirror half of {@link withoutCodeBlocks}, applied AFTER it so a span
 * split across nothing a fence let through is still removed.
 */
const withoutCodeSpans = (lines: string): string => {
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
  return prose
}

/**
 * EVERY ADDRESS A PIECE OF PROSE POINTS AT, in the order it writes them and
 * never twice.
 *
 * `from` is the file the markdown was WRITTEN in — a document for its own
 * body, the defining outline for a node's note — because that is what a
 * relative link is relative to, exactly as {@link pictureOf} already is. One rule for both, which is the point: a `[…](…)` in a note and
 * a `[…](…)` in a document mean the same thing, and a face that read one of
 * them differently would be the parity hole this round exists to close.
 *
 * The three things a link here can name are the three the address grammar has:
 *
 *   - `../projects/deck.md` — any relative path: another document, an
 *     outline, a `.pdf` a page draws, a picture a page opens ({@link pathedOf}'s
 *     refusals are this function's).
 *   - `notes/README.md#install` — a heading inside one. The fragment is cut off
 *     BEFORE the path is resolved, because `#` is the grammar's punctuation and
 *     `README.md#install` is not a filename.
 *   - `#a1b2c3` — a node, wherever it lives. It is the one link with no
 *     document half, and there is no file there to resolve, so it is read
 *     straight as the address it is.
 *
 * A SCAN, NOT A PARSE, and the boundary is worth naming: this package holds no
 * markdown parser and deliberately does not gain one here (`./derive.ts` makes
 * the same refusal about tags, for the same reason — it is the floor the write
 * gate stands on). What the scan DOES know is literal code — a tight or loose
 * code span, a fenced or indented block — and it removes it BEFORE the links
 * are read, so a `[…](…)` inside one is not a link at all. That is one
 * scanner, shared by the faces, the references index and the dead-link
 * reading: a link in a fence is drawn as text by the browser, and drawing a
 * backlink or a dead link where the browser draws nothing would be the two
 * readings of one text.
 *
 * NEVER TWICE, and the container says so: a note that links the same document
 * three times points at it once. What reads this wants the EDGES.
 */
export const linksIn = (claims: Claims, from: string, text: string): ReadonlyArray<Address> => {
  // The cheap negative first: nearly every note in a directory holds no link
  // at all, and this is asked of every record and every body of the set.
  if (!text.includes("](")) return NO_LINKS
  let found: Array<Address> | undefined
  let seen: Set<string> | undefined
  // THE PROSE, ONCE — literal code taken out before a single link is read
  // (the two readers that used to skip it themselves are gone; this is the
  // one place the markdown syntax decision lives).
  const prose = withoutCodeSpans(withoutCodeBlocks(text))
  for (const href of writtenLinks(prose)) {
    const address = linkTo(claims, from, href)
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
 * The scan still does not parse: the label may not hold a `]`, and code
 * removal is the CALLER's — {@link linksIn} strips literal code before it
 * asks this, while {@link bracketSpacedLinks} reads the raw text, which is
 * exactly the split a renderer's rewrite needs. What it now reads, that the
 * pattern would not, is a filename with a space in it —
 * CommonMark's angle-bracketed destination, and the space left raw, which
 * is the spelling people write. An optional title is still dropped: a
 * space that opens `"…"` / `'…'` / `(…)` is markdown's title, not part of
 * the path.
 */
export const writtenLinks = (text: string): ReadonlyArray<string> => {
  const found: Array<string> = []
  eachTarget(text, (target) => {
    found.push(destinationOf(target))
  })
  return found
}

/**
 * THE TARGETS OF LINKS IN RENDERED PROSE — the same scan as
 * {@link writtenLinks}, with literal code already removed. This is the
 * scanner every reading of what prose SAYS goes through: {@link linksIn}
 * resolves these to addresses, and the dead-link reading
 * (`./dead-links.ts`) asks which of them name nothing served. One scanner,
 * because a link in a fence is drawn as text by the browser and no reading
 * may treat it as a link.
 */
export const proseLinks = (text: string): ReadonlyArray<string> =>
  text.includes("](") ? writtenLinks(withoutCodeSpans(withoutCodeBlocks(text))) : []

/**
 * Rewrite a `[…](…)` whose destination holds a space into the angle-bracket
 * form CommonMark's parser will read.
 *
 * The scan above already names those files. The renderer goes through a
 * parser that will not: a space inside parentheses is not a destination, so
 * `[the brief](the brief.md)` never becomes an `<a>` and the page's own
 * resolver never sees the name. Wrapping the destination — and only the
 * destination, so an optional title stays a title — is the one edit that
 * makes the two readings agree, and it is this scan's inverse rather than
 * a second parser.
 *
 * Identity when nothing needs wrapping, so a cache keyed on the source
 * does not churn.
 */
export const bracketSpacedLinks = (text: string): string => {
  if (!text.includes("](")) return text
  let out = ""
  let last = 0
  let changed = false
  eachTarget(text, (target, open, close) => {
    const dest = destinationOf(target)
    if (!SPACE.test(dest) || target.startsWith("<")) return
    out += text.slice(last, open) + `<${dest}>` + target.slice(dest.length)
    last = close
    changed = true
  })
  return changed ? out + text.slice(last) : text
}

/** Every parenthesised target, in document order. `open` is the character
 *  after `(`, `close` is the matching `)`. */
const eachTarget = (
  text: string,
  visit: (target: string, open: number, close: number) => void,
): void => {
  let label = -1
  for (let at = 0; at < text.length; at++) {
    const char = text[at]
    if (char === "[") label = at
    else if (char === "]") {
      if (label !== -1 && text[at + 1] === "(") {
        const close = text.indexOf(")", at + 2)
        if (close !== -1) {
          visit(text.slice(at + 2, close), at + 2, close)
          at = close
        }
      }
      label = -1
    }
  }
}

/**
 * The destination inside a parenthesised target: unwrap `<…>`, else take
 * the path up to markdown's optional title.
 */
const destinationOf = (target: string): string => {
  if (target.startsWith("<")) {
    const end = target.indexOf(">")
    return end === -1 ? target.slice(1) : target.slice(1, end)
  }
  const title = target.search(TITLE)
  return title === -1 ? target : target.slice(0, title)
}

/** Markdown's optional title: whitespace, then a quoted or parenthesised
 *  string. A space that is not this is a character of the filename. */
const TITLE = /\s+["'(]/

/** A space in a destination, as a class rather than a repetition. */
const SPACE = /\s/

/** The answer for prose that points nowhere and for a record that does — which
 *  is most of both: ONE list, shared, as `./derive.ts` shares its own. */
const NO_LINKS: ReadonlyArray<Address> = []

/**
 * EVERY ADDRESS ONE RECORD POINTS AT, in the order it writes them.
 *
 * The forward half of a reference, per record — and it is a function of its own
 * because it is read BOTH WAYS: {@link outlineDocument} folds it into an
 * outline's face, and `./backlinks.ts` reads it backwards to say which record
 * of a file the reference was written in. Two walks of the same fields would be
 * two answers to "does this node point there", and the page would draw one of
 * them while the face claimed the other.
 *
 * Three things a record can point at, and one it deliberately cannot:
 *
 *   - a `see`, the format's free cross-reference and the one edge no
 *     derivation reads, so the forward half of it belongs in a list of what
 *     this record points at.
 *   - a `[…](…)` in its TITLE, and one in its NOTE — the same rule a
 *     document's body is read by, so a link means the same thing wherever it
 *     is written ({@link ./documents.ts}'s `linksIn`).
 *
 * `after` and `blocks` are NOT here: they are the ORDERING graph, and saying
 * an ordering edge under the word "points at" would put one fact under a name
 * that means something else — the ruling `./backlinks.ts` already makes from
 * the other end.
 *
 * A MIRROR points at nothing of its own. It is a second placement of a node,
 * carrying no prose and no edge fields; what it shows is the node's, and the
 * node is where the reference is written.
 */
export const recordLinks = (claims: Claims, located: Located): ReadonlyArray<Address> => {
  if (isMirror(located.node)) return NO_LINKS
  const found: Array<Address> = []
  for (const id of located.node.see ?? []) {
    const address = addressOf(claims, null, id)
    if (address !== null) found.push(address)
  }
  found.push(...linksIn(claims, located.file, located.node.title))
  if (located.node.desc !== undefined) {
    found.push(...linksIn(claims, located.file, located.node.desc))
  }
  return found
}

/** What one written link names, or `null` — the grammar's three arms, told
 *  apart by where the `#` is.
 *
 * THE PATH HALF IS WIDE on purpose: any relative path a file of the set could
 * hold is a document address, whatever suffix it carries, because the set
 * gives EVERY file a page. An outline is a document with a page and a
 * reading of its own, a `.pdf` is a body whose page draws it, and `![](…)`,
 * which {@link eachTarget} reads as a link with an empty label, names the
 * same document an `[…](…)` would. The renderer's own half of the same
 * question — what a rewritten `href` is allowed to point at — asks
 * {@link bodyKind} directly and is NOT this one. This one reads the whole
 * grammar — the path, the kind it names, and the address it is spelled as —
 * and the renderer's narrower question is its own. */
const linkTo = (claims: Claims, from: string, href: string): Address | null => {
  const cut = href.indexOf("#")
  if (cut === 0) return addressOf(claims, null, href.slice(1))
  const path = cut === -1 ? href : href.slice(0, cut)
  const resolved = pathedOf(from, path)
  return resolved === null ? null : addressOf(claims, resolved, cut === -1 ? null : href.slice(cut + 1))
}
