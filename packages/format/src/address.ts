/**
 * WHAT A PLACE IN A SERVED DIRECTORY IS CALLED.
 *
 * One grammar — `[document]#[element]` — and every feature that has to name
 * something trades in it (https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/first-class-documents.md, ruled
 * 2026-08-19). A URL is one, a pin holds one, a link in a note writes one, and
 * an agent will speak one; what they have in common is not a prefix table but
 * a *type*, so a feature does not handle nodes AND documents, it handles
 * addresses — which name a whole document or an element inside one, evenly.
 *
 * | Address | Names |
 * |---|---|
 * | `Tasks.olai` | an outline document |
 * | `README.md` | a markdown document |
 * | `#a1b2c3` | a node — the document half is optional |
 * | `README.md#install` | a heading — the document half is required |
 *
 * **The document half of a node address is optional, and the bare id is what
 * this prints.** Node ids are unique across the loaded set and survive renames
 * and moves between files, so a bare `#id` outlives every edit short of a
 * delete — the property the browser's node permalink argued for, kept.
 * The qualified spelling is READ (`Tasks.olai#a1b2c3` is what somebody writes
 * when they know where the node lives) and NORMALISED away, because the file
 * in it is a fact that can go stale and the id beside it cannot.
 *
 * **A markdown element's identity is its heading slug**, derived from the
 * words in the heading. Rewording the heading breaks the address; that is
 * accepted for this round, and the later evolution — an opt-in explicit
 * `## Install {#setup}` — is named in the design and not designed here.
 *
 * ## Which half decides what a `#` means
 *
 * `#install` after a `.md` is a heading and `#a1b2c3` after a `.olai` is a
 * node, and NOTHING about the two fragments tells them apart — both are text
 * somebody typed. What tells them apart is the DOCUMENT: an outline has nodes
 * and no headings, a body has headings and no nodes, and which of the two a
 * path is, is the registry's answer and not a guess ({@link fileKind}). So the
 * kind of an element is read off the file it is in, which is also why
 * {@link DocumentPath} insists on a suffix the registry claims: a path with no
 * kind is a path this grammar cannot finish reading.
 *
 * That insistence is what lets the browser spell a content URL as `/` plus an
 * address with no prefix at all: every document names a file, every file
 * carries a suffix, and a computed page (`/today`, `/agenda`) spells none — so
 * the two vocabularies cannot collide (`@olai/web`'s `routes.ts`).
 *
 * ## Total, both ways
 *
 * {@link printAddress} is total over an {@link Address}, and
 * {@link parseAddress} is total over any string — `null` for text that is not
 * an address, never a throw. The consumers are the address bar, a title in
 * `Pins.olai` that the format invites a hand and an agent to edit, and an
 * href written in somebody's note; a `URIError` out of any of those is not a
 * bad address, it is a blank page, since a throw during render takes the tree
 * that was rendering with it. What cannot be read names nothing.
 *
 * PRINTED FOR A URL, which is to say percent-encoded: a name is somebody's
 * words and an address is punctuation, so the two are kept apart by escaping
 * the characters this grammar has claimed. The separator between path segments
 * survives ({@link printAddress} encodes per segment) so a reader still
 * recognises the folder in the bar.
 */

import { Schema } from "effect"

import { type FileKind, fileKind, holdsBody } from "./kinds.ts"

/**
 * A path that names a file the directory SERVES — `Tasks.olai`,
 * `notes/README.md`, relative to the served root.
 *
 * The rule is the registry's ({@link fileKind}): a suffix no kind claims is not
 * a document, so `notes` and `photo.tiff` are not paths this grammar can name —
 * while `photo.png` is one, since the day a picture became a kind with a page
 * of its own. The rule did not move; the table under it did.
 * That is not tidiness — it is the fact the whole grammar rests on, since the
 * suffix is what says whether a `#` after it is a heading or a node, and what
 * keeps an address apart from a computed page that spells no file.
 *
 * WHERE THAT RULE LIVES is {@link claimedKind}, and it is spent TWICE — as a
 * check on this schema, so a decoded path is judged by it, and as
 * {@link addressOf}'s guard, so a minted one is judged by the same sentence.
 * Both, rather than either, and PR 2 is what made it both: effect's `brand` is
 * NOMINAL — it narrows the type and adds no runtime check — so while the only
 * addresses in the process were minted in the browser's hot path (a URL per
 * drawn row) and read back by one parser, the guard was the whole rule and the
 * schema was a promise about where a value came from. An `Address` DECODES off
 * a wire now (a search hit carries one, `./searching.ts`), and a decode that
 * did not ask this question would be a path the grammar cannot finish reading,
 * arriving as one it can.
 *
 * The CONSTRUCTION side still does not go through the parser, and that is
 * unchanged and deliberate: `make` would run the check a second time for a
 * verdict {@link addressOf} has already reached, once per printed URL.
 */
export const DocumentPath = Schema.String.check(
  Schema.makeFilter((path: string) => claimedKind(path) !== null, {
    expected: "a relative path to a file some kind of the registry claims",
  }),
).pipe(Schema.brand("DocumentPath"))
export type DocumentPath = typeof DocumentPath.Type

/** The id of one node, unique across the loaded set — what a node address is
 *  made of, and the whole of it. Any non-empty text: an id is minted here
 *  (`./ord.ts`'s alphabet) or chosen by whoever captured the node, and an
 *  address that could not carry a chosen one would be an address that stopped
 *  working the day somebody wrote `#kitchen`. */
export const NodeId = Schema.String.pipe(Schema.brand("NodeId"))
export type NodeId = typeof NodeId.Type

/** What a heading in a body is called: the id it is drawn with — `rehype-slug`'s
 *  derivation of the words in it for a `.md`, and whatever its author wrote for
 *  a `.html`. Derived rather than stored, which is exactly why rewording a
 *  heading breaks the address that names it. */
export const Slug = Schema.String.pipe(Schema.brand("Slug"))
export type Slug = typeof Slug.Type

/**
 * A tag AS IT IS WRITTEN — the sigil and the name, `#topic` or `@person`.
 *
 * It is a primitive of this vocabulary rather than of the walk that finds one
 * because a tag is a NAME in the same sense the three above are: `./derive.ts`
 * decides where one starts and stops in a title, and what it hands back is one
 * of these. Two namespaces, never two spellings of one — `#alice` and `@alice`
 * are different tags — which is why the sigil is part of the value and not
 * something a reader adds back.
 */
export const Tag = Schema.String.pipe(Schema.brand("Tag"))
export type Tag = typeof Tag.Type

/** A whole document: `Tasks.olai`, `notes/README.md`. */
export const AtDocument = Schema.Struct({
  kind: Schema.Literal("document"),
  path: DocumentPath,
})
export type AtDocument = typeof AtDocument.Type

/** One node, by its id and nothing else — the location-free half of the
 *  grammar. */
export const AtNode = Schema.Struct({
  kind: Schema.Literal("node"),
  id: NodeId,
})
export type AtNode = typeof AtNode.Type

/** One heading inside a body, which takes both halves: a slug is derived from
 *  the words of a heading, so it is unique inside its own document and nowhere
 *  else. */
export const AtHeading = Schema.Struct({
  kind: Schema.Literal("heading"),
  path: DocumentPath,
  slug: Slug,
})
export type AtHeading = typeof AtHeading.Type

/** The three things an address can name. A sum rather than one struct with
 *  optional halves, for `./node.ts`'s reason: `{path?, id?, slug?}` makes the
 *  illegal combinations representable — a slug with no document, an id beside
 *  a path — and pushes "which fields may co-occur" into every reader. */
export const Address = Schema.Union([AtDocument, AtNode, AtHeading])
export type Address = typeof Address.Type

/**
 * The three halves, NAMED — a value this module has just judged, wearing the
 * brand that says so.
 *
 * A cast rather than the schemas' own `make`, and that is a decision rather
 * than a shortcut: `make` runs the parser, and the parser has nothing to check
 * (the brands are nominal, and the rule they stand for is {@link addressOf}'s
 * guard three lines up). What it does have is a cost — two schema parses per
 * printed URL, on a path that runs once per drawn row of the tree — for a
 * verdict the caller has already reached.
 */
const documentPath = (path: string): DocumentPath => path as DocumentPath
const nodeId = (id: string): NodeId => id as NodeId
const slug = (text: string): Slug => text as Slug

/**
 * The address of a place, from the two halves somebody named — or `null` for a
 * pair that names none.
 *
 * ONE constructor for all three arms, because the arms are not a choice a
 * caller makes: which one a document-and-element pair lands on is this
 * grammar's rule (an element of an outline is a node, an element of a body is
 * a heading, an element with no document is a node), and a caller that picked
 * the arm itself would be a second copy of that rule free to disagree with
 * {@link parseAddress}. It is also where the NORMALISATION lives —
 * `Tasks.olai#a1b2c3` is an id in an outline, so it comes back as the bare
 * node it names.
 *
 * `null` for both halves empty (nothing named), for a document half that is
 * not a served file's path, and for an element with neither a document nor a
 * name. An empty element beside a real document is not a failure — it is a
 * document with nothing after the `#`, which names the document.
 */
export const addressOf = (
  document: string | null,
  element: string | null,
): Address | null => {
  const named = element === null || element === "" ? null : element
  if (document === null || document === "") {
    return named === null ? null : { kind: "node", id: nodeId(named) }
  }
  const kind = claimedKind(document)
  if (kind === null) return null
  const path = documentPath(document)
  if (named === null) return { kind: "document", path }
  // WHICH KIND OF ELEMENT is the registry's `holds` column and not a list of
  // suffixes read again here: a file whose content is a BODY has headings in
  // it, and one whose content is records has nodes. A kind that held records
  // would be a node address by that rule rather than by falling through the
  // last arm of a ternary (`./kinds.ts`). It is `holdsBody` and not
  // `holdsText`: a picture has no headings and a `.pdf` none this app can
  // read, and an address into one landing on nothing is what a `.md` whose
  // heading was renamed already does — where reading them as NODE addresses
  // would be the grammar claiming a vault's pictures hold records.
  return holdsBody(kind)
    ? { kind: "heading", path, slug: slug(named) }
    : { kind: "node", id: nodeId(named) }
}

/**
 * The address, written, in the TWO HALVES the grammar is made of — the
 * document and the element, each percent-encoded, neither carrying the `#`
 * between them.
 *
 * Encoded per path segment, so the separator a reader recognises survives and
 * every character this grammar has claimed cannot be confused with one
 * somebody's filename happens to hold. An empty `path` is the node arm, whose
 * document half is the absence of one.
 *
 * It exists because of who has to write an address into something LONGER than
 * itself: a URL puts its query between a path and a fragment, so the browser
 * needs the seam ({@link printAddress} joins what it would then have to cut
 * back open). Two functions, one of them defined as the other — rather than a
 * caller re-reading a string this module has just written.
 */
export const writtenAddress = (
  address: Address,
): { readonly path: string; readonly element: string | undefined } => {
  if (address.kind === "node") {
    return { path: "", element: encodeURIComponent(address.id) }
  }
  const path = spellPath(address.path)
  return address.kind === "document"
    ? { path, element: undefined }
    : { path, element: encodeURIComponent(address.slug) }
}

/** The address, written whole — the two halves above with the grammar's own
 *  `#` between them, which is then the only unescaped one in the result. */
export const printAddress = (address: Address): string => {
  const { path, element } = writtenAddress(address)
  return element === undefined ? path : `${path}#${element}`
}

/**
 * The address a string names, or `null` for a string that names none.
 *
 * The written form of {@link printAddress}, read back: cut at the first `#`,
 * decode each half, and hand both to {@link addressOf} — so what a pair of
 * halves means is decided in one place rather than once per direction.
 *
 * AN UNREADABLE ELEMENT NAMES NO ELEMENT, rather than sinking the address it
 * was written on: `README.md#%ZZ` is the document, drawn as it would have been
 * drawn with no fragment at all. An unreadable PATH is different, and has to
 * be — there is nothing left to name.
 */
export const parseAddress = (text: string): Address | null => {
  const cut = text.indexOf("#")
  const document = cut === -1 ? text : text.slice(0, cut)
  const element = cut === -1 ? "" : spelled(text.slice(cut + 1))
  const path = readPath(document)
  return path === null ? null : addressOf(path, element)
}

/**
 * PATH, QUERY AND FRAGMENT of an address, cut the way this app writes them.
 *
 * ONE split, so nothing that reads an address twice can disagree about where
 * the query ends and the fragment starts. The FRAGMENT COMES OFF FIRST: a `#`
 * ends a query, so cutting on `?` before it would leave `#beds` inside a
 * filter and a page narrowed by a word nobody typed.
 *
 * The fragment comes back AS WRITTEN, unescaped, because it is half of an
 * address and {@link parseAddress} is what reads it. Decoding it here would be
 * this function holding an opinion about a name, and re-joining a decoded half
 * to a written one is how a `#` inside somebody's heading becomes a second cut.
 *
 * IT IS HERE rather than in the browser that mints these URLs, and the move is
 * the one {@link linkedTitle} below is: three readers cut this — the URL parser,
 * the workspace that embeds pages in one, and the SHELF reading over on the
 * server (`./shelf.ts`, finding the node a pin addresses) — and the third one
 * put a fourth spelling of it on the other side of a wire. What is NOT here,
 * and stays the browser's, is what the halves MEAN: which page a pathname
 * opens, and that the query is a filter (docs/format.md's Pins).
 */
export const splitAddress = (address: string): Split => {
  const hash = address.indexOf("#")
  const whole = hash === -1 ? address : address.slice(0, hash)
  const fragment = hash === -1 ? undefined : address.slice(hash + 1)
  const cut = whole.indexOf("?")
  return {
    pathname: cut === -1 ? whole : whole.slice(0, cut),
    search: cut === -1 ? "" : whole.slice(cut + 1),
    fragment,
  }
}

/** An address cut into the three things a URL keeps apart. Named, because a
 *  parser is handed one rather than a string to cut again. */
export interface Split {
  readonly pathname: string
  /** What is between the `?` and the `#`, without the `?` — read by whoever
   *  knows what a query means here, which is not this package. */
  readonly search: string
  readonly fragment: string | undefined
}

/**
 * THE ADDRESS A TITLE CARRIES: the title itself, or the target of the one link
 * it is written as.
 *
 * The other half of {@link linkedTitle}'s reason for being here — both sides of
 * the pin convention ask this exact question of a title, one to draw the page it
 * names and one to resolve the node it names (`./shelf.ts`), and one expression
 * spelled twice is a rule that eventually disagrees with itself.
 */
export const addressWritten = (title: string): string =>
  linkedTitle(title)?.at ?? title.trim()

/**
 * A title written as ONE MARKDOWN LINK around an address, cut into its two
 * halves — `undefined` for every other title.
 *
 * Here because two readers cut it, on opposite sides of a wire, and a regex
 * spelled twice is a rule that eventually disagrees with itself. The SHELF's
 * reading takes the target of it (`./shelf.ts`, resolving what a pin's node is
 * called), and the BROWSER takes both halves — the target to read as a page,
 * and the label as the name somebody chose (`@olai/web`'s `address/address.ts`,
 * docs/format.md's Pins). Neither of them is the other's caller, and both are
 * about one sentence of that convention.
 *
 * DELIBERATELY NARROW: exactly one link and nothing around it. A title with
 * prose either side of a link is a sentence somebody wrote, not a place with a
 * name on it — and reading it as one would make a door out of a note. What this
 * must NOT become is a markdown parser: titles are inline markdown in this
 * format, and what one LOOKS like is decided where it is drawn.
 *
 * The halves come back AS WRITTEN. What an empty label means, and what the
 * target names, are the readers' own questions — this one is only where the
 * brackets are.
 */
export const linkedTitle = (
  title: string,
): { readonly label: string; readonly at: string } | undefined => {
  const linked = LINKED.exec(title.trim())
  return linked === null ? undefined : { label: linked[1] ?? "", at: linked[2] ?? "" }
}

/** One markdown link and nothing else: `[label](target)`, with no whitespace or
 *  parenthesis in the target — the shape {@link linkedTitle} reads. */
const LINKED = /^\[([^\]]*)\]\(([^()\s]+)\)$/

/**
 * A PIN'S TITLE, for a name somebody typed — the inverse of
 * {@link linkedTitle}, and the one place a named pin is spelled.
 *
 * It is here because the reader is, and for the same argument: two writers cut
 * this, on opposite sides of a wire — the SERVER, resolving the `pin` a
 * browser sent into the row it adds to `Pins.olai`
 * (`@olai/server`'s `edit.ts`), and the BROWSER, renaming a pin that is
 * already up there with the `set_title` an agent would send
 * (`@olai/web`'s `pins/naming.ts`). A title written one way and read another
 * is a row that stops being a door, which is the one failure a shelf cannot
 * show you.
 *
 * A BLANK NAME IS THE BARE ADDRESS, which is what makes this ONE function
 * rather than two: naming nothing is the ordinary pin this app has always
 * written, and un-naming one is typing the name away. Both callers want the
 * title a pin should carry given the words somebody typed, and neither wants
 * to hold the rule about which of the two that is.
 *
 * `undefined` IS A REFUSAL AND NOT A FALLBACK ({@link PIN_NAME_UNWRITABLE} is
 * the sentence for it): the label reader above is deliberately narrow, so a
 * `]` in the words would close the link early and leave a title that is no
 * longer an address at all. Writing it anyway would take the row off the shelf
 * without saying so — the silent failure this codebase is written against — and
 * writing it MANGLED would be this function holding an opinion about somebody's
 * name.
 *
 * THE TARGET IS ESCAPED where the link's own grammar cannot carry it, which is
 * not the same kind of decision: a `(` in a path is unspellable INSIDE a link
 * and means exactly what `%28` means to every reader of an address here — the
 * path is decoded per segment, the query by `URLSearchParams`, the element by
 * the grammar. So a named pin to `plan (old).olai` is a door, where a name with
 * a bracket in it is refused. The bare form is untouched, because nothing about
 * it is inside a link.
 */
export const pinTitle = (at: string, name: string): string | undefined => {
  const label = name.trim()
  const address = at.trim()
  if (label === "") return address
  if (UNWRITABLE.test(label)) return undefined
  return `[${label}](${escaped(address)})`
}

/** Why a name was refused, in the words both faces spend — the browser's own
 *  line under a rename, and the server's `UsageFailure` on a `pin` that
 *  carried one. */
export const PIN_NAME_UNWRITABLE =
  "a pin's name is written as a link's label, so it cannot hold a “]” or a line break"

/** The two things a label cannot hold: the bracket that would end it, and a
 *  break — a title is one line, and {@link LINKED} is anchored to one. */
const UNWRITABLE = /[\]\r\n]/

/** The three characters {@link LINKED}'s target cannot carry, written the way
 *  every reader of an address here already reads them. */
const escaped = (address: string): string =>
  address.replace(
    /[()\s]/g,
    (one) => `%${one.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  )

/**
 * WHICH KIND of file a path names — `null` for a path this grammar cannot
 * name at all.
 *
 * The whole of {@link DocumentPath}'s rule, in one function, spent by the
 * schema's check and by {@link addressOf}'s guard — one reading rather than
 * two, which is the point of moving it out of the guard at all. It answers
 * with the KIND rather than with a yes, because the one caller that passes it
 * needs that answer next anyway: which of the two things a `#` after this path
 * would name.
 *
 * The SUFFIX half is the grammar's foundation: it is what says whether a `#`
 * after a path is a heading or a node, and what keeps an address apart from a
 * computed page that spells no file.
 *
 * The PLACE half is a relative path with every segment a real name.
 *
 * A leading `/` and a `..` are the two that matter and they matter for
 * different reasons. `..` is somebody naming a place OUTSIDE the directory,
 * which is not a place this grammar has words for (the store refuses to read
 * one either). A leading slash is worse in the browser: an address is printed
 * after a `/`, so `/x.olai` would print as `//x.olai` — which a browser reads
 * as a URL on ANOTHER HOST, and an address that can leave the site is not an
 * address this may mint.
 */
const claimedKind = (path: string): FileKind | null =>
  path.split("/").every((segment) =>
      segment !== "" && segment !== "." && segment !== ".."
    )
    ? fileKind(path)
    : null

/**
 * Encoded per segment, so a path with a directory in it stays readable rather
 * than turning into a run of `%2F`.
 *
 * The test first, and it is not a micro-optimisation looking for a home: this
 * runs once per link the browser draws, per frame, and nearly every filename
 * in a vault is already the characters a URL takes verbatim. The walk is what
 * the answer IS; the test is what says the answer is the argument.
 */
const spellPath = (path: string): string =>
  PLAIN.test(path) ? path : path.split("/").map(encodeURIComponent).join("/")

/** EXACTLY the characters `encodeURIComponent` leaves alone, plus the
 *  separator {@link spellPath} keeps. Written as that list and not as a wider
 *  one a URL would also tolerate: the point is that a path matching this IS
 *  its own encoding, so the test can stand in for the walk without the two
 *  ever printing different strings for one address. */
const PLAIN = /^[A-Za-z0-9\-_.!~*'()/]*$/

/**
 * The other end of {@link spellPath} — `null` when any segment was written
 * with an escape nothing can read.
 *
 * Per SEGMENT because `%2F` is a slash in somebody's filename rather than a
 * separator, and a whole-string decode would turn one into the other. A path
 * with no `%` in it can hold neither, so it is its own reading — which is
 * every path a person types and every one this module prints.
 */
const readPath = (text: string): string | null => {
  if (!text.includes("%")) return text
  const segments = text.split("/").map(spelled)
  return segments.includes(null) ? null : segments.join("/")
}

/**
 * What a written half SPELLS, or `null` for an escape no address could have
 * been written with.
 *
 * `decodeURIComponent` THROWS on a malformed escape (`%`, `%ZZ`, `%2`), and a
 * parser that throws is a parser these callers cannot use: what is read here
 * is what a person typed into an address bar and what a hand or an agent wrote
 * into a title. A `URIError` out of either is a blank page rather than a bad
 * address.
 */
const spelled = (text: string): string | null => {
  try {
    return decodeURIComponent(text)
  } catch {
    return null
  }
}
