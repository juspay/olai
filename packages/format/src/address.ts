/**
 * WHAT A PLACE IN A SERVED DIRECTORY IS CALLED.
 *
 * One grammar — `[document]#[element]` — and every feature that has to name
 * something trades in it (docs/brainstorming/first-class-documents.md, ruled
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

import { fileKind } from "./kinds.ts"

/**
 * A path that names a file the directory SERVES — `Tasks.olai`,
 * `notes/README.md`, relative to the served root.
 *
 * The refinement is the registry's ({@link fileKind}): a suffix no kind claims
 * is not a document, so `notes` and `photo.png` are not paths this grammar can
 * name. That is not tidiness — it is the fact the whole grammar rests on, since
 * the suffix is what says whether a `#` after it is a heading or a node, and
 * what keeps an address apart from a computed page that spells no file.
 */
export const DocumentPath = Schema.String.pipe(Schema.brand("DocumentPath"))
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
    return named === null ? null : { kind: "node", id: NodeId.make(named) }
  }
  const kind = fileKind(document)
  if (kind === null || !relative(document)) return null
  const path = DocumentPath.make(document)
  if (named === null) return { kind: "document", path }
  return kind === "outline"
    ? { kind: "node", id: NodeId.make(named) }
    : { kind: "heading", path, slug: Slug.make(named) }
}

/**
 * The address, written.
 *
 * Percent-encoded, per path segment, so the separator a reader recognises
 * survives and every character this grammar has claimed — the `#` above all —
 * cannot be confused with one somebody's filename happens to hold.
 *
 * The `#` this writes is therefore the ONLY unescaped one in the result, which
 * is what lets a caller that has to put something between the halves (a
 * browser's query string, which a URL puts before the fragment) cut the
 * printed form at it.
 */
export const printAddress = (address: Address): string => {
  if (address.kind === "node") return `#${encodeURIComponent(address.id)}`
  const path = spellPath(address.path)
  return address.kind === "document" ? path : `${path}#${encodeURIComponent(address.slug)}`
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
  if (document === "") return addressOf(null, element)
  const path = readPath(document)
  return path === null ? null : addressOf(path, element)
}

/**
 * Whether a path is one the served directory could actually hold: a relative
 * path, with every segment a real name.
 *
 * A leading `/` and a `..` are the two that matter and they matter for
 * different reasons. `..` is somebody naming a place OUTSIDE the directory,
 * which is not a place this grammar has words for (the store refuses to read
 * one either). A leading slash is worse in the browser: an address is printed
 * after a `/`, so `/x.olai` would print as `//x.olai` — which a browser reads
 * as a URL on ANOTHER HOST, and an address that can leave the site is not an
 * address this may mint.
 */
const relative = (path: string): boolean =>
  path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")

/** Encoded per segment, so a path with a directory in it stays readable rather
 *  than turning into a run of `%2F`. */
const spellPath = (path: string): string =>
  path.split("/").map(encodeURIComponent).join("/")

/** The other end of {@link spellPath} — `null` when any segment was written
 *  with an escape nothing can read. */
const readPath = (text: string): string | null => {
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
