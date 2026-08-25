/**
 * WHAT ONE FILE OF A SERVED DIRECTORY IS.
 *
 * The type this whole arc exists to make
 * (docs/brainstorming/first-class-documents.md, ruled 2026-08-19). Before it,
 * a served directory held two wildly unequal things: a `Node` — id, position,
 * title, marks, date, edges, props — and a document, which was `{file, text}`.
 * No id, no title, no edges. The root cause was one sentence: **a document had
 * no addressable identity below the file, so everything keyed on ids excluded
 * it by construction** — which is why graph view drew no `.md`, search walked
 * past every body, and each fix patched one feature while the next one started
 * node-only again.
 *
 * So the fix is not parity feature by feature. It is a type whose SHAPE makes
 * the node-only version unwritable:
 *
 * ```
 * data Document = Outline  Face [Node]
 *              | Markdown Face Text Bytes [Slug]
 *              | Unkept    UnkeptKind Face
 * ```
 *
 * A sum of products, no nullable fields, no downcasting. Every arm carries the
 * same {@link Face} — a path, a title, the addresses it points at, the tags it
 * writes — and all of it is TOTAL. There is no `Maybe` to branch on, which is
 * exactly what makes "handle the nodes, skip the rest" stop being the shortest
 * way to write a feature.
 *
 * ## Nodes did not become documents
 *
 * They became the SUBSTRUCTURE OF ONE ARM. `Node` keeps every field it ever
 * had (`./node.ts`); what changed is its standing — part of an outline
 * document rather than a peer of documents. The set no longer serves a `nodes`
 * collection beside a `documents` one, so a feature has no node-only list to
 * import: the nodes are reachable, through the outline they are written in.
 *
 * ## Three arms, over the six kinds the registry claims
 *
 * Discriminated on `kind`, which is `./kinds.ts`'s own word for the file. A
 * kind added to that table is a compile error at every `Record` and every
 * exhaustive match in the tree, which is the enforcement this replaces a
 * review comment with.
 *
 * THE ARMS ARE SHAPES AND THE TAGS ARE KINDS, which is what the viewers made
 * visible: four of the six kinds are a face and nothing else — a `.html`, a
 * `.csv`, a picture, a `.pdf` — so they share the {@link Unkept} arm and each
 * carries its own tag, read off the registry's own `UnkeptKind`. Sharing the
 * arm is not sharing the answer: a caller still switches on `kind` and still
 * gets the registry's word for the file.
 *
 * THE TAG IS THE SUFFIX SAID TWICE, and that is a decision reversed rather
 * than an oversight. What this replaced carried no tag at all, on the argument
 * that "`fileKind` already answers that from the path, and `decode` branched
 * on that same answer to produce this — so a tag would be a second answer that
 * could disagree with the name" (`./set.ts`, before PR 2). That argument is
 * still true and it is outweighed: a union told apart by which FIELDS it
 * happens to carry is not exhaustively checkable — a reader writes `"nodes" in
 * document` and the compiler has nothing to say about the case they forgot,
 * which is precisely how a feature came to handle records and skip everything
 * else. What keeps the two from disagreeing is that a caller never picks the
 * arm: both constructors below read the registry, so the tag is
 * `fileKind`'s answer carried on the value rather than a second one.
 *
 * The names of the arms are the MODEL's and the discriminants are the
 * REGISTRY's, and that is worth saying once because they do not match:
 * {@link Markdown} is `kind: "document"`, because "document" is what the
 * registry has always called a `.md` and this sum is what the model calls all
 * three. Renaming either half would be renaming it everywhere it is already
 * spelled — the table, the wire, the tool descriptions an agent reads.
 *
 * {@link Unkept} is the arm with nothing but a face, and its emptiness is a
 * decision recorded rather than a gap: those four are the files olai only ever
 * SHOWS, so the set keeps their paths and not their bytes (`./kinds.ts`'s
 * `kept`, which owns that argument). One points at nothing and tags nothing
 * because nothing here has read it — which is honest, and is not the same claim
 * as "it holds no links".
 *
 * ## The face is DERIVED, and this is where
 *
 * Nothing in the format changed on disk. A `.md` still has no record to write
 * a title on, so its title is its first line; its links are where its `[…](…)`
 * land; its tags are the `#topic` and `@person` in its prose, read by the same
 * walk that reads a note's; its elements are the slugs of its headings. Those
 * were four helpers scattered across two packages, called by whoever
 * remembered them ({@link ./documents.ts}'s `firstLine` and `bodiedOf` were
 * both, and the browser had a `preview.ts` of its own). They are FIELDS now,
 * which is the whole difference: a consumer cannot forget to call a field.
 *
 * **...and one field that is not derived at all.** `props` is a `.md`'s YAML
 * frontmatter, read by {@link ./frontmatter.ts} — the document's own authored
 * record, and the half of the brainstorm's "later" this round took. It is
 * PROPERTIES and not a record: `prop:agent=claude-opus` selects a document the
 * way it selects a node, through one `propKeyOf`, while `is:done`, `has:date`
 * and `date:today` still select no document at all. There is nowhere on a
 * `.md` for a MARK or a DAY — a document with one would have to appear on the
 * day page, the agenda and the calendar, all three of which read a node — so
 * that half stays the honest nothing it was, and stays named rather than
 * quietly patched.
 *
 * ## Where the face is BUILT, and why it is not here
 *
 * Once per file per change, at the DECODE — `@olai/ops`' codec, which is the
 * one place a file's bytes become a value and the one place the store caches
 * by content stamp. Not at {@link ./set.ts}'s `assemble`, which runs over every
 * file of the directory on every revision: a face built there would re-walk the
 * whole corpus's prose for each keystroke, which is precisely the cost the
 * patched derivation was built to stop paying (docs/brainstorming/
 * model-indices.md). So the constructors below are what a decode calls, and
 * `assemble` only collects what they made.
 */

import { Schema } from "effect"

import { Address, addressOf, DocumentPath, printAddress, Slug, Tag } from "./address.ts"
import { Custom } from "./custom.ts"
import { tagsIn, writtenTags } from "./derive.ts"
import { frontmatterIn, proseIn } from "./frontmatter.ts"
import { bytesOf, firstLine, linksIn, recordLinks } from "./documents.ts"
import { fileKind, UNKEPT_KINDS, stemOf } from "./kinds.ts"
import { isMirror, Located } from "./node.ts"
import { slugsIn } from "./slug.ts"

/**
 * WHAT EVERY DOCUMENT HAS, whichever kind it is — the fields a feature is
 * handed when it asks the set for one.
 *
 * Total, all four of them, and that totality is the design rather than a
 * convenience: a feature that had to ask "does this kind have a title" would be
 * a feature with a node-shaped path and a document-shaped path, which is the
 * shape every parity hole in this app was.
 *
 * They are spread into each arm rather than nested under a `face` field. A
 * nested one would read better in this file and worse in all of the fifty that
 * consume it — `document.face.title` beside `document.nodes` puts a reader in
 * front of a question the model does not have, which is which half of a
 * document a fact is about.
 */
export const Face = Schema.Struct({
  /** Its identity: where it is, relative to the served root. The one thing
   *  every kind has had all along, and the only thing a shown file has. */
  path: DocumentPath,
  /** What it is CALLED. An outline is called by its filename; a markdown
   *  document by its first non-empty line, heading marks off, since that is the
   *  closest thing a `.md` has to a name — and by its filename when the body
   *  has nothing to say, so a title is never blank on screen. */
  title: Schema.String,
  /** Every address its content points at, in the order it writes them and never
   *  twice — a `doc` attachment, a `see`, a link in a note, a link in a body.
   *  This is the forward half of the graph; a page that shows who points AT
   *  something reads it backwards (`./backlinks.ts`). */
  links: Schema.Array(Address),
  /** The tags its prose writes, as written — both sigils, `#topic` and
   *  `@person`, which are two namespaces over one alphabet (`./derive.ts`). */
  tags: Schema.Array(Tag),
  /**
   * The named facts the file writes ABOUT ITSELF — a `.md`'s YAML frontmatter,
   * read by {@link ./frontmatter.ts} and answered by `prop:` in the query
   * grammar exactly as a record's `custom` map is.
   *
   * TOTAL like the other four, and empty for the five kinds that write none: an
   * outline's records carry their own properties (a file is not one of its
   * nodes), and the other four are the files olai only ever shows. Empty
   * because NOTHING WROTE ONE, which is the same honest sentence the unkept
   * arm's empty `links` and `tags` already say, and not a slot waiting to be
   * filled in.
   *
   * `Custom` and not a type of its own: a document's properties ARE a record's
   * properties — one open namespace, no key given a meaning by olai, text or a
   * list of it — so one `propKeyOf` answers both (`./filter.ts`) and one
   * drawer draws both. The FIELD is named for what a reader calls them, which
   * is what the operator is spelled; `custom` is the record's word for the one
   * open field beside its closed ones, and a `.md` has no closed fields for
   * these to be custom relative to.
   *
   * They are PROPERTIES and not a record. A `date:` here is a property named
   * "date" and not the journal's day, a `done:` is a property and not a mark,
   * a `tags:` is a property and not one of the tags above — which this format
   * writes with a sigil in prose. `./frontmatter.ts`'s header argues that
   * ruling; the short of it is that a document carrying a real date would have
   * to appear on the day page, the agenda and the calendar, all three of which
   * read a NODE.
   */
  props: Custom,
})
export type Face = typeof Face.Type

/**
 * A document's face, on its own — what is known about a file once its CONTENT
 * is set aside.
 *
 * It exists for the WIRE, and for one reason that is worth stating rather than
 * inferring: a body does not travel with the set. A directory of thousands of
 * `.md` files publishes its bodies one key at a time, read by whoever is
 * showing one (`@olai/surface`), so a browser that had only the collection
 * would know a document's PATH and nothing else about it — which is exactly the
 * position every feature was in before this arc, one layer out. The face is the
 * cheap half: a title, the addresses it points at, the tags it writes, the
 * properties its frontmatter holds. It rides on the entries that already
 * travel per file, and it is what lets a palette row carry a name, a
 * document's page draw its record and say who points at it, without fetching a
 * word of prose.
 *
 * A PROJECTION and not a second type: every arm below IS one of these plus its
 * content, so what crosses the wire is a value this module made and not a shape
 * somebody assembled to match it.
 */
export const faceOf = ({ path, title, links, tags, props }: Document): Face => ({
  path,
  title,
  links,
  tags,
  props,
})

/**
 * A `.olai`: the records this app is about, and the face they add up to.
 *
 * `nodes` is the tree exactly as it always was — ids, positions, marks, dates,
 * edges, props, every field of {@link ./node.ts} — carried as {@link Located},
 * which is the record WITH the file and line it was read at. That the file is
 * on every record and again on this document is not a fact stored twice: the
 * records are the ones `assemble` collected, and the walks that read them
 * (`./derive.ts`, `./patch.ts`) are keyed on what the record says about itself.
 */
export const Outline = Schema.Struct({
  kind: Schema.Literal("outline"),
  ...Face.fields,
  nodes: Schema.Array(Located),
})
export type Outline = typeof Outline.Type

/**
 * A `.md`: prose, verbatim, and what can be read out of it.
 *
 * `body` is the text as it is on disk — markdown is interpreted at view time,
 * so nothing here has parsed it. It is IN the set for the reason a note's
 * `desc` is on the record: it is read by the same probe, cached against the
 * same stamp and published in the same revision as every outline, so an edit
 * reaches an open page through the machinery that was already there and there
 * is one answer to what the directory says right now.
 *
 * `bytes` is what the body WEIGHS as UTF-8 — remembered here at decode so a
 * listing does not re-encode every served `.md` to report a size
 * (`list_documents`, `@olai/ops`' `query.ts`). {@link ./documents.ts}'s
 * `bytesOf` is how it is measured; this is that answer given a field.
 *
 * `headings` is what makes a document ADDRESSABLE BELOW THE FILE, which is the
 * sentence the whole arc turns on: the slugs of its headings, in document
 * order, deduped the way the page that draws them dedupes (`./slug.ts`). They
 * are what `README.md#install` names.
 */
export const Markdown = Schema.Struct({
  kind: Schema.Literal("document"),
  ...Face.fields,
  body: Schema.String,
  /**
   * The body's size in UTF-8 bytes. Total, like the rest of the face: an empty
   * document weighs nothing, and a listing that had to re-derive this from
   * `body` would be the cost this field exists to stop paying.
   */
  bytes: Schema.Int,
  headings: Schema.Array(Slug),
})
export type Markdown = typeof Markdown.Type

/**
 * A file olai only ever SHOWS: a saved `.html`, a `.csv` table, a picture, a
 * `.pdf` — sitting in the vault with everything else.
 *
 * A FACE AND NOTHING ELSE, and the emptiness is `./kinds.ts`'s `kept: false`
 * showing through: nothing validates one, no op writes one, and a vault of
 * saved pages and pictures made their bodies the largest thing in the process.
 * So the set holds the path — which is all a `doc` reference was ever checked
 * against — and the content is read, or fetched, when a reader opens it and
 * kept by nobody (`@olai/server`'s `bodies.ts` for the ones this process can
 * read, the media route for the ones the browser fetches itself).
 *
 * Its `links` and `tags` are therefore EMPTY BECAUSE NOTHING READ IT, not
 * because a saved page points nowhere. The distinction matters the day the
 * graph is drawn: a `.html` is a vertex with no edges out of it, and it is one
 * for a reason a reader can be told.
 *
 * IT IS NAMED FOR `kept` AND NOT FOR "SHOWN", which is the reader's word for
 * these four and the word this docstring spends: `Shown` is taken, one package
 * layer up, for what one PAGE shows (`./page.ts`), and one word for two things
 * in one repository is the ambiguity the registry already refused for
 * "hypertext". The storage fact is the honest second name — this arm is exactly
 * the bodied files `unkept` answers `true` for — and it is the fact the arm's
 * emptiness comes from.
 *
 * ONE ARM AND FOUR TAGS, which is the shape this gained with the viewers and
 * the one place the sum's arm-per-kind rule is worth reading twice. The
 * discriminant is still the KIND and still the registry's own answer — a `.csv`
 * says `csv` — so no file is filed under another kind's name, which is what
 * that rule is about; what four separate structs would add is four identical
 * declarations of `{ kind, ...Face.fields }` and three more members for every
 * union decode to walk. The tags are read off {@link ./kinds.ts}'s
 * `UnkeptKind`, so this arm cannot come to name a kind the table does not
 * claim, or miss one it does.
 */
export const Unkept = Schema.Struct({
  kind: Schema.Literals(UNKEPT_KINDS),
  ...Face.fields,
})
export type Unkept = typeof Unkept.Type

/** The three shapes a served file can be, across the six kinds there are. */
export const Document = Schema.Union([Outline, Markdown, Unkept])
export type Document = typeof Document.Type

/**
 * The document a parsed outline amounts to — {@link ./parse.ts}'s answer, once
 * its records are in hand.
 *
 * ONE WALK of the records for the whole face, and it is the only walk of the
 * corpus's prose this arc adds: a decode already read every line of the file to
 * get here, and this reads what those lines SAY. The nodes are handed straight
 * through.
 */
export const outlineDocument = (
  file: string,
  nodes: ReadonlyArray<Located>,
): Outline => {
  const links: Array<Address> = []
  const tags: Array<Tag> = []
  const seen = new Set<string>()
  const written = new Set<string>()
  // Written and compared, because a canonical spelling is what the grammar
  // promises and re-deriving a key here would be a second answer to it.
  const add = (address: Address | null): void => {
    if (address === null) return
    const key = printAddress(address)
    if (seen.has(key)) return
    seen.add(key)
    links.push(address)
  }
  for (const located of nodes) {
    for (const address of recordLinks(located)) add(address)
    if (isMirror(located.node)) continue
    for (const tag of writtenTags(located.node)) {
      if (written.has(tag)) continue
      written.add(tag)
      tags.push(tag)
    }
  }
  return {
    kind: "outline",
    path: pathOf(file),
    // The FILENAME, which is what an outline has always been called: every
    // sidebar entry, every breadcrumb and every commit subject already spells
    // the stem, and this is that answer given a field rather than re-derived
    // per drawing.
    title: stemOf(file),
    links,
    tags,
    // A FILE writes no properties of its own here: an outline's named facts
    // are on its records, where `set_prop` puts them, and a `.olai` has no
    // frontmatter to read. Empty because nothing wrote one, which is the same
    // sentence the unkept arm's empty `links` says.
    props: {},
    nodes,
  }
}

/**
 * The document a BODIED file amounts to — a `.md` with its text, or a `.html`
 * with only its path.
 *
 * WHICH ARM is the registry's answer and not the caller's: a caller that picked
 * would be a second reading of `./kinds.ts`'s table, free to disagree with the
 * one that decided the file was bodied in the first place. `text` for an
 * UNKEPT file is therefore DROPPED rather than refused — the set does not keep that
 * body, and a caller holding one is a caller who read a file this arm has
 * nothing to store it in.
 *
 * `null` is what a decode that keeps no body hands over, and an unreadable
 * file arrives as an empty one ({@link ./set.ts}'s `assemble` says why): a
 * document the set holds a place for and no content.
 */
export const bodiedDocument = (file: string, text: string | null): Markdown | Unkept => {
  const path = pathOf(file)
  // THE KIND, and not `unkept` beside it, which a review proposed and this
  // line answers: which arm a file lands on is the KIND's own question, and the
  // tag it carries is that same answer rather than a second one. `unkept` asks
  // a different question — does the set keep this file's BYTES — and branching
  // on it would file a kept bodied kind under this arm's name the day one
  // arrives. What is handed over below is `Exclude<BodyKind, "document">`,
  // which is assignable to `UnkeptKind` exactly while `document` is the only
  // bodied kind the set keeps: the day it is not, this line goes red rather
  // than lying.
  const kind = fileKind(file)
  if (kind !== null && kind !== "outline" && kind !== "document") {
    return { kind, path, title: stemOf(file), links: [], tags: [], props: {} }
  }
  const body = text ?? ""
  // THE PROSE, ONCE — the body with any frontmatter taken off
  // ({@link ./frontmatter.ts}). Two of the four readings below ask for it here
  // rather than themselves, and the split is not arbitrary: `firstLine` and
  // `slugsIn` are only ever about a document's BODY, so each asks on its own
  // and is honest to any caller; `tagsIn` and `linksIn` are asked of a record's
  // title and note as well, where a leading `---` is a thematic break like any
  // other and skipping it would be this package inventing frontmatter for a
  // bullet.
  const prose = proseIn(body)
  return {
    kind: "document",
    path,
    // The first line, and the FILENAME when there is none — an empty document
    // and one that opens with a picture both have a name on screen, and the
    // name they have is the one the sidebar already draws.
    title: firstLine(body) || stemOf(file),
    links: linksIn(file, prose),
    tags: tagsIn(prose),
    // The record a document is allowed to write about itself, and the one
    // field of this face that is not derived from prose at all.
    props: frontmatterIn(body),
    body,
    // THE WEIGHT, ONCE — `bytesOf` is the definition of the number a listing
    // reports, and calling it here (cached with the decode) is what makes a
    // listing O(documents) rather than O(the bytes of every served `.md`).
    bytes: bytesOf(body),
    headings: slugsIn(body),
  }
}

/**
 * The body of a document, or `null` for a kind that keeps none.
 *
 * The one question the wire asks of this sum — a published entry carries a
 * document's text, and `null` means "served, and its body is not here"
 * (`@olai/server`'s `published.ts`, which has the argument). It is a function
 * rather than a field so that the arms stay honest: an unkept file has no
 * `body` to be `null`, it has no body.
 */
export const bodyOf = (document: Document): string | null =>
  document.kind === "document" ? document.body : null

/** Whether a document is an outline — the narrowing every reader of the nodes
 *  goes through, named once rather than spelled as a `kind` test wherever it is
 *  wanted (`isMirror`, `./node.ts`, is the same move one level down). */
export const isOutline = (document: Document): document is Outline =>
  document.kind === "outline"

/** The path, BRANDED — a value this module has judged by the one thing that
 *  makes a path nameable, which is the registry claiming its suffix. Every
 *  caller here got its `file` from a directory walk that matched on exactly
 *  that (`@olai/ops`' codec's `match`), so this is the verdict already reached
 *  said in the type. */
const pathOf = (file: string): DocumentPath => file as DocumentPath
