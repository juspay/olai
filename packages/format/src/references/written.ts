/**
 * WHAT ONE DOCUMENT CONTRIBUTES to the references table — which of its records
 * (or its own body) points at which target, in which PART of the table that
 * target lives, and the WAY each one points.
 *
 * The references reading answers two questions that used to be two modules
 * and two walks ({@link ./referring.ts}); the fold IS those walks' readings,
 * kept because the LINES OF PROSE are what make the difference and the table
 * is where the prose is spent once instead of once per page per revision.
 *
 * ABOUT THE PART AND THE KEY, which are one decision: what is pointed at says
 * where the entry lands ({@link PARTS}), and inside a part the key is the
 * plainest spelling of that thing — a ROW by its bare id, a FILE by its
 * printed address (`brief.md`, `brief.md#scope`), a NAME by the folded key a
 * wikilink is resolved through, a TAG as it was written (`#herbs`, `@herbs`).
 * Four maps rather than one, because a row PRINTS as `#herbs` and a topic is
 * WRITTEN `#herbs`: one map of strings would have the two collide, and no
 * spelling rule can separate them — the table's shape does it instead.
 *
 * THE WAYS ARE KEPT APART HERE because the readings need them apart, and each
 * reading names the ways it counts ({@link ./referring.ts}'s `WAYS` is the
 * four **Referenced by** counts): a record's FIELDS name a row with `mirror`,
 * `after`, `blocks` and `see`, a record's PROSE writes a `tag`, a body's prose
 * writes a `mention`, a link — or an embed — names a file, a row or a name
 * with `link`, and a declared `doc`, `ref` or `node` VALUE names a file or a
 * row with `property` ({@link propertiesOf}). One record doing two of them is
 * one source with two ways.
 *
 * WHAT IS NOT HERE is a single decision about meaning: a `#topic` is not a
 * mention (only the `@` half of a tag is a name), a record never refers to
 * itself, a placement is a placement rather than a claim, and what is put away
 * is left out at the read. Those are the READING's rulings
 * ({@link ./referring.ts}), asked of this table the way every other reverse
 * index of this format is read.
 */

import { type Address, addressOf, printAddress } from "../address.ts"
import { writtenTags } from "../derive.ts"
import { type Face } from "../document.ts"
import { recordRead } from "../kept.ts"
import { addressOfPlace, placeOf } from "../links/standard.ts"
import { wikilinkKey, wikilinkRowNode } from "../links/wikilink.ts"
import type { Read } from "@olai/prose/read.ts"
import type { WikilinkName } from "@olai/prose/wikilink.ts"
import { type Claims } from "../kinds.ts"
import { isMirror, isRegular, type Located, targetsOf } from "../node.ts"
import { declaredFor, isReference, type PropDeclarations, resolvedDoc } from "../typing.ts"

/**
 * THE FOUR PARTS OF THE TABLE, by WHAT IS POINTED AT — a row of an outline, a
 * file (whole, or one heading or row of it), a wikilink's name, or a tag as
 * written.
 *
 * It is a list here, where the fold decides which part an entry belongs in,
 * rather than beside the table itself: a contribution says its own part, and
 * the table ({@link ./pointing.ts}) is four maps keyed by this list, so a part
 * added is a part every carry and every walk of the table learns about by
 * typechecking rather than by somebody remembering.
 */
export const PARTS = ["rows", "files", "names", "tags"] as const
export type Part = (typeof PARTS)[number]

/**
 * The ways a contribution is FILED under, in the order a source says them: the
 * fields somebody wrote with a verb first, then the prose they wrote after
 * them, then the links, then the property values — which are last because they
 * are filed last ({@link propertiesOf}: a second pass, after the declarations
 * are read), so a source's `ways` come out in this order however it was built.
 *
 * WIDER THAN WHAT A READING COUNTS, and that is the table's whole arrangement:
 * every way a document can point at something is filed once, and each reader
 * names the ways its own question is about ({@link ./referring.ts}'s `WAYS`
 * for **Referenced by**; the refusals and the reports in `@olai/ops` for the
 * field ways). A list that held only the counted three would be the table
 * telling the derivation's readers to go and walk the corpus themselves.
 */
export const FILED_WAYS = ["mirror", "after", "blocks", "see", "tag", "mention", "link", "property"] as const
export type Way = (typeof FILED_WAYS)[number]

/**
 * ONE TARGET A DOCUMENT WRITES TO — the part of the table it lands in, the key
 * it files under there, the way it was named, and the record that did the
 * naming when there is one. A body's targets carry no record: a `.md` has no
 * finer grain than itself.
 */
export interface Contribution {
  /** Which of the table's four maps this entry belongs in. */
  readonly part: Part
  /** The key to file under, in that part's own spelling — a row's bare id, a
   *  file's printed address, a wikilink's folded key, a tag as written. */
  readonly key: string
  readonly way: Way
  /** The record, for an outline. Undefined for a body, whose every
   *  contribution carries no record — a `.md` is its own source. */
  readonly at: Located | undefined
  /** The target ADDRESS for the LINK way — what the table's heading rule
   *  decides by (a link onto a heading or a row points at the document as
   *  well). Absent for the field and prose ways, which file under one key
   *  only. */
  readonly address?: Address
  /** The WIKILINK as written, for the wikilink entries — the name the reading
   *  resolves against the name index when it reads. */
  readonly wikilink?: WikilinkName
  /** The property KEY a `property` entry's value was written under, AS THE
   *  RECORD WROTE IT ({@link propertiesOf}) — the word a refusal names when it
   *  says what to re-point. The declaration it was matched against is folded
   *  ({@link declaredFor}); this is the spelling in the file. */
  readonly prop?: string
}

/**
 * WHAT ONE DOCUMENT CONTRIBUTES to the table: one {@link Contribution} per
 * written target, in the order the document writes them.
 *
 * THE FOLD IS WHERE THE PROSE IS READ INTO THE TABLE: {@link readAddresses}
 * and {@link writtenTags} ask the readings decode kept, and a record's title,
 * its note, its fields and its tags are each read ONCE here instead of once
 * per page per revision at the read.
 *
 * A RECORD'S FIELDS ARE {@link targetsOf} READ FORWARDS — the one list of what
 * a record NAMES, which the validator asks forwards and the ops layer asks
 * backwards, and which this fold files under the table's `rows` part from the very same
 * function. A second list of field names here is the failure that function's
 * own doc warns about: the day a fifth relation is added, a table that scanned
 * for four would silently stop seeing one.
 *
 * A PLACEMENT IS A SOURCE, and the only one whose record is not regular: it
 * names the node it stands for with `mirror` and writes nothing else — no
 * prose, no edges, no links. **Referenced by** does not count that way, so a
 * placement is filed here and left out there ({@link ./referring.ts}).
 *
 * A RECORD'S TAGS GO IN WHOLE, BOTH SIGILS, with the way `tag` — every record
 * under each tag it writes, in the table's `tags` part. The `@` half is
 * what the mention reading asks for; the `#` half is the vocabulary the tag
 * list reads. A BODY contributes what its face already carries — every link it
 * writes is a `link`, every `@` tag it writes a `mention` — so the fold reads a
 * body's prose exactly once, with the face, and a body's `#topic` is filed
 * nowhere, so the tags part holds none for a body.
 */
export const contributionsOf = (
  claims: Claims,
  face: Face,
  records: ReadonlyArray<Located> | undefined,
): ReadonlyArray<Contribution> => {
  const found: Array<Contribution> = []
  if (records === undefined) {
    for (const link of face.links) linkInto(found, link, undefined)
    for (const tag of face.tags) {
      if (tag.charAt(0) !== "@") continue
      found.push({ part: "tags", key: tag, way: "mention", at: undefined })
    }
    for (const link of face.wikilinks ?? []) wikiInto(found, claims, link, undefined)
    return found
  }
  // THE FACE SAYS whether any record of the file writes a wikilink, so a file
  // that writes none pays no scan of its titles and notes for `[[`.
  const linking = face.wikilinks !== undefined
  for (const located of records) {
    // THE FIELDS, under the ROWS they name — the mirror a placement points
    // with and the three edge fields a record writes, in declaration order.
    for (const [field, id] of targetsOf(located.node)) {
      found.push({ part: "rows", key: id, way: field, at: located })
    }
    // …and nothing else comes off a placement: it has no title, no note and no
    // links of its own, which is what the type says one line down.
    if (!isRegular(located)) continue
    // THE RECORD'S LINKS are ONE walk ({@link recordContributions}, the same
    // one {@link recordLinks} dedupes for the faces), filed under the
    // addresses they land on. Its `see` arm is passed
    // over here: the fields above are where this table reads `see` from, so
    // the two spellings of "which ids does this record name" cannot drift.
    for (const written of recordContributions(claims, located)) {
      if (written.way !== "link") continue
      linkInto(found, written.address, located)
    }
    for (const tag of writtenTags(located.node)) {
      found.push({ part: "tags", key: tag, way: "tag", at: located })
    }
    if (linking) for (const link of recordWikilinks(located)) wikiInto(found, claims, link, located)
  }
  return found
}

/** A LINK, under the thing it lands on: a bare node link files under the ROW
 *  it names, and every other address under the FILE half of the table, printed
 *  — which is the spelling the reading asks with ({@link ./pointing.ts}'s
 *  `pointingAt`). The address travels with the entry, because a link onto a
 *  heading or a row is a reference to the document as well and the table files
 *  that second key where the two parts are both in hand. */
const linkInto = (found: Array<Contribution>, address: Address, at: Located | undefined): void => {
  found.push(
    address.kind === "node"
      ? { part: "rows", key: address.id, way: "link", at, address }
      : { part: "files", key: printAddress(address), way: "link", at, address },
  )
}

/** A WIKILINK, filed under the name it writes rather than the file it finds
 *  (`./links/wikilink.ts`'s `wikilinkKey`) — the NAMES part, and for its
 *  reason: which file a name finds moves with the directory, so the reading
 *  resolves it when it reads and a file arriving makes no one re-read another
 *  file. A link to the writer's own heading refers to nothing else, and is not
 *  filed. A link to a ROW is filed a second time, under the row's own id,
 *  which is where the node arm of the reading asks. */
const wikiInto = (found: Array<Contribution>, claims: Claims, link: WikilinkName, at: Located | undefined): void => {
  const key = wikilinkKey(claims, link.target)
  if (key !== null) found.push({ part: "names", key, way: "link", at, wikilink: link })
  const node = wikilinkRowNode(claims, link)
  if (node?.kind === "node") found.push({ part: "rows", key: node.id, way: "link", at, wikilink: link })
}

/**
 * WHAT ONE OUTLINE'S RECORDS POINT AT THROUGH THEIR PROPERTIES — the table's
 * SECOND fold, run after the first one for a reason that is about order rather
 * than about tidiness.
 *
 * The format gives no key in `custom` a meaning: which ones hold REFERENCES is
 * what the VAULT declares ({@link ../typing.ts}), and the declarations are read
 * off the derivation, whose own carry is handed the table the first fold made
 * ({@link ./pointing.ts}). So a revision goes: the fields, the prose and the
 * tags; then the derivation; then the declared kinds; then this.
 *
 * A `doc` VALUE NAMES A FILE and a `ref` or a `node` value names a ROW, which
 * is the whole of the mapping and is {@link isReference} read one level down.
 * The resolution is {@link resolvedDoc}'s — the one both the write gate and the
 * display ask, so what a value NAMES is one answer and this table cannot come
 * to disagree with the fence about it — and a value that resolves to no
 * CLAIMED path is filed nowhere, because nothing can ask about a place this
 * directory does not serve.
 *
 * RECORDS ONLY. A body's frontmatter is a face's `props` and no refusal has
 * ever read it: the two in `@olai/ops` that this fold feeds walk the records,
 * and a table that quietly filed more than they asked for would be this fold
 * deciding a question neither of them has been asked.
 *
 * A PLACEMENT CARRIES NO PROPERTIES, like it carries no prose and no link.
 *
 * THE KEY TRAVELS WITH THE ENTRY — the word as the record spelled it — because
 * a refusal names it ("`lane` (`agent`, lanes.olai:12)"), and recovering it
 * from the record at the read would be this fold's own matching done twice.
 */
export const propertiesOf = (
  claims: Claims,
  declarations: PropDeclarations,
  records: ReadonlyArray<Located>,
): ReadonlyArray<Contribution> => {
  if (declarations.size === 0) return NO_PROPERTIES
  const found: Array<Contribution> = []
  for (const located of records) {
    if (!isRegular(located)) continue
    const custom = located.node.custom
    if (custom === undefined) continue
    for (const [key, value] of Object.entries(custom)) {
      // FOLDED, through the format's own reading, so a record writing `Agent`
      // is found by a vault declaring `agent` — the same word to the fence, to
      // `prop:` and to this.
      const declared = declaredFor(declarations, key)
      if (!isReference(declared)) continue
      const doc = declared?.type.kind === "doc"
      for (const one of typeof value === "string" ? [value] : value) {
        if (!doc) {
          if (one !== "") found.push({ part: "rows", key: one, way: "property", at: located, prop: key })
          continue
        }
        const resolved = resolvedDoc(declared, located.file, one)
        const address = resolved === undefined ? null : addressOf(claims, resolved, null)
        if (address === null) continue
        found.push({ part: "files", key: printAddress(address), way: "property", at: located, prop: key, address })
      }
    }
  }
  return found
}

/** The answer for a vault that declares no reference key, which is most of
 *  them: ONE list, shared — and the whole of what "such a directory pays no
 *  walk" means ({@link referenceKeys}). */
const NO_PROPERTIES: ReadonlyArray<Contribution> = []

// ── what a record or a body points at ──────────────────────────────────

/** The answer for prose that points nowhere and for a record that does — which
 *  is most of both: ONE list, shared, as `../derive.ts` shares its own. */
const NO_LINKS: ReadonlyArray<Address> = []

/**
 * EVERY ADDRESS ONE RECORD POINTS AT, in the order it writes them.
 *
 * The forward half of a reference, per record — and it is a function of its own
 * because it is read BOTH WAYS: `../document.ts`'s `outlineDocument` folds it
 * into an outline's face, and the fold above reads it to say which record of a
 * file an entry's `at` came from. Two walks of the same fields would be two
 * answers to "does this node point there", and the page would draw one of
 * them while the face claimed the other.
 *
 * The WAYS are kept apart because the fold needs them apart: {@link
 * recordContributions} is this walk in the table's own vocabulary, so the
 * fold files a `see` under the id it names and a link under the address it
 * lands on — and here that is one list, deduped, which is the DRAWING's
 * answer. One walk, two projections.
 *
 * Three things a record can point at, and one it deliberately cannot:
 *
 *   - a `see`, the format's free cross-reference.
 *   - a `[…](…)` in its TITLE, and one in its NOTE — the same rule a
 *     document's body is read by, so a link means the same thing wherever it
 *     is written ({@link readAddresses}).
 *
 * `after` and `blocks` are NOT here: they are the ORDERING graph, and saying
 * an ordering edge under the word "points at" would put one fact under a name
 * that means something else — the ruling `./referring.ts` already makes from
 * the other end.
 *
 * A MIRROR points at nothing of its own. It is a second placement of a node,
 * carrying no prose and no edge fields; what it shows is the node's, and the
 * node is where the reference is written.
 */
export const recordLinks = (claims: Claims, located: Located): ReadonlyArray<Address> =>
  recordContributions(claims, located).map((one) => one.address).filter(isAddress)

const isAddress = (address: Address | undefined): address is Address => address !== undefined

/** One record's written targets, in the fold's own vocabulary, in the order
 *  the record writes them. {@link recordLinks} is its deduped address
 *  projection; the fold keeps the `way` and the target address it files
 *  under. */
export const recordContributions = (
  claims: Claims,
  located: Located,
): ReadonlyArray<{ readonly way: "see" | "link"; readonly address: Address; readonly at: Located }> => {
  const found: Array<{ readonly way: "see" | "link"; readonly address: Address; readonly at: Located }> = []
  if (isMirror(located.node)) return found
  for (const id of located.node.see ?? []) {
    const address = addressOf(claims, null, id)
    if (address !== null) found.push({ way: "see", address, at: located })
  }
  const said = recordRead(located.node)
  for (const address of readAddresses(claims, located.file, said.title)) found.push({ way: "link", address, at: located })
  if (said.desc !== null) {
    for (const address of readAddresses(claims, located.file, said.desc)) found.push({ way: "link", address, at: located })
  }
  return found
}

/**
 * EVERY ADDRESS A TEXT'S READING POINTS AT, in the order it writes them and
 * never twice — its links and its pictures, each resolved from `from`, the
 * file the text was written in, by the one rule the page and the dead-link
 * reading ask too (`../links/standard.ts`). The reading made one call of the
 * parser, so code, a comment and an escape hold no link here exactly as on the
 * page.
 *
 * THE PATH HALF IS WIDE on purpose: any relative path a file of the set could
 * hold is a document address, whatever suffix it carries, because the set
 * gives EVERY file a page — and a picture names the same document an
 * `[…](…)` would.
 */
export const readAddresses = (claims: Claims, from: string, said: Read): ReadonlyArray<Address> => {
  let found: Array<Address> | undefined
  let seen: Set<string> | undefined
  for (const link of said.links) {
    const place = placeOf(from, link)
    const address = place === null ? null : addressOfPlace(claims, place)
    if (address === null) continue
    const written = printAddress(address)
    if ((seen ??= new Set()).has(written)) continue
    seen.add(written)
    ;(found ??= []).push(address)
  }
  return found ?? NO_LINKS
}

/** The wikilinks some readings write, each as the name it looks up, in order
 *  and never twice. */
export const wikilinkNames = (reads: ReadonlyArray<Read>): ReadonlyArray<WikilinkName> => {
  let named: Map<string, WikilinkName> | undefined
  for (const said of reads) {
    for (const link of said.wikilinks) {
      // Told apart by a key of this loop's own, never read back.
      const key = [link.target, ...link.fragments].join("\0")
      if (!(named ??= new Map()).has(key)) named.set(key, { target: link.target, fragments: link.fragments })
    }
  }
  return named === undefined ? NO_NAMES : [...named.values()]
}

const NO_NAMES: ReadonlyArray<WikilinkName> = []

/** The wikilinks one record writes in its title and its note — what the table
 *  files under each name, beside {@link recordContributions}. A placement
 *  writes none. */
export const recordWikilinks = (located: Located): ReadonlyArray<WikilinkName> => {
  if (isMirror(located.node)) return NO_NAMES
  const said = recordRead(located.node)
  return wikilinkNames(said.desc === null ? [said.title] : [said.title, said.desc])
}