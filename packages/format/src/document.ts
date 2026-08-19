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
 * data Document = Outline   Face [Node]
 *               | Markdown  Face Text [Slug]
 *               | Hypertext Face
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
 * ## Three arms, because the registry claims three kinds
 *
 * Discriminated on `kind`, which is `./kinds.ts`'s own word for the file. A
 * fourth kind added to that table is a compile error at every `Record` and
 * every exhaustive match in the tree, which is the enforcement this replaces a
 * review comment with.
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
 * {@link Hypertext} is the arm with nothing but a face, and its emptiness is a
 * decision recorded rather than a gap: a `.html` is the one file olai only ever
 * SHOWS, so the set keeps its path and not its bytes (`./kinds.ts`'s `kept`,
 * which owns that argument). It points at nothing and tags nothing because
 * nothing here has read it — which is honest, and is not the same claim as
 * "it holds no links".
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
 * **Frontmatter is the named next step and is not designed here.** YAML at the
 * top as the document's own authored record — dates, edges, props, possibly
 * marks — waits until the derived face is standing. Until it exists, a query
 * over a field a document lacks (`is:done`) selects nothing in one, which is
 * the honest answer and the hole frontmatter fills.
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
import { tagsIn, writtenTags } from "./derive.ts"
import { firstLine, linksIn, recordLinks } from "./documents.ts"
import { fileKind, stemOf } from "./kinds.ts"
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
   *  every kind has had all along, and the only thing hypertext has. */
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
 * cheap half: a title, the addresses it points at, the tags it writes. It rides
 * on the entries that already travel per file, and it is what lets a palette row
 * carry a name and a document's page say who points at it without fetching a
 * word of prose.
 *
 * A PROJECTION and not a second type: every arm below IS one of these plus its
 * content, so what crosses the wire is a value this module made and not a shape
 * somebody assembled to match it.
 */
export const faceOf = ({ path, title, links, tags }: Document): Face => ({
  path,
  title,
  links,
  tags,
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
 * `headings` is what makes a document ADDRESSABLE BELOW THE FILE, which is the
 * sentence the whole arc turns on: the slugs of its headings, in document
 * order, deduped the way the page that draws them dedupes (`./slug.ts`). They
 * are what `README.md#install` names.
 */
export const Markdown = Schema.Struct({
  kind: Schema.Literal("document"),
  ...Face.fields,
  body: Schema.String,
  headings: Schema.Array(Slug),
})
export type Markdown = typeof Markdown.Type

/**
 * A `.html`: a page somebody saved or a tool built, sitting in the vault with
 * everything else.
 *
 * A FACE AND NOTHING ELSE, and the emptiness is `./kinds.ts`'s `kept: false`
 * showing through: nothing validates it, no op writes it, and a vault of saved
 * pages made their bodies the largest thing in the process. So the set holds
 * its path — which is all a `doc` reference was ever checked against — and its
 * body is read when a reader opens it and kept by nobody (`@olai/server`'s
 * `bodies.ts`).
 *
 * Its `links` and `tags` are therefore EMPTY BECAUSE NOTHING READ IT, not
 * because a saved page points nowhere. The distinction matters the day the
 * graph is drawn: a `.html` is a vertex with no edges out of it, and it is one
 * for a reason a reader can be told.
 */
export const Hypertext = Schema.Struct({
  kind: Schema.Literal("hypertext"),
  ...Face.fields,
})
export type Hypertext = typeof Hypertext.Type

/** The three things a served file can be. */
export const Document = Schema.Union([Outline, Markdown, Hypertext])
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
    nodes,
  }
}

/**
 * The document a BODIED file amounts to — a `.md` with its text, or a `.html`
 * with only its path.
 *
 * WHICH ARM is the registry's answer and not the caller's: a caller that picked
 * would be a second reading of `./kinds.ts`'s table, free to disagree with the
 * one that decided the file was bodied in the first place. `text` for a
 * hypertext file is therefore DROPPED rather than refused — the set does not
 * keep that body, and a caller holding one is a caller who read a file this
 * arm has nothing to store it in.
 *
 * `null` is what a decode that keeps no body hands over, and an unreadable
 * file arrives as an empty one ({@link ./set.ts}'s `assemble` says why): a
 * document the set holds a place for and no content.
 */
export const bodiedDocument = (file: string, text: string | null): Markdown | Hypertext => {
  const path = pathOf(file)
  // THE KIND, and not `unkept` beside it, which a review proposed and this
  // line answers: the arms here are ONE PER KIND, so which arm a file lands on
  // is the kind's own question. `unkept` asks a different one — does the set
  // keep this file's BYTES — and they agree today only because the one bodyless
  // kind is this one. A fourth unkept kind would need an arm of its own, and
  // branching on `kept` would have quietly filed it under this one's name.
  if (fileKind(file) === "hypertext") {
    return { kind: "hypertext", path, title: stemOf(file), links: [], tags: [] }
  }
  const body = text ?? ""
  return {
    kind: "document",
    path,
    // The first line, and the FILENAME when there is none — an empty document
    // and one that opens with a picture both have a name on screen, and the
    // name they have is the one the sidebar already draws.
    title: firstLine(body) || stemOf(file),
    links: linksIn(file, body),
    tags: tagsIn(body),
    body,
    headings: slugsIn(body),
  }
}

/**
 * The body of a document, or `null` for a kind that keeps none.
 *
 * The one question the wire asks of this sum — a published entry carries a
 * document's text, and `null` means "served, and its body is not here"
 * (`@olai/server`'s `published.ts`, which has the argument). It is a function
 * rather than a field so that the arms stay honest: hypertext has no `body` to
 * be `null`, it has no body.
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
