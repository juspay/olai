/**
 * WHAT ONE DOCUMENT CONTRIBUTES to the references index — which of its records
 * (or its own body) points at which target, and the WAY each one points.
 *
 * The references reading answers two questions that used to be two modules
 * and two walks ({@link ./backlinks.ts}); the fold IS those walks' readings,
 * kept because the LINES OF PROSE are what make the difference and the index
 * is where the prose is spent once instead of once per page per revision.
 *
 * ABOUT THE KEY: a `see` and a link resolve to an ADDRESS and file under its
 * printed form (`#herbs`, `brief.md#scope`). An `@id` written in prose files
 * under the tag AS WRITTEN (`@herbs`) — {@link Derived.taggedBy}'s key, and
 * therefore the key the mention half of the reading asks. Two namespaces, one
 * index — exactly as `taggedBy` keeps both sigils, and for its reason.
 *
 * THE WAYS ARE KEPT APART HERE because the reading needs them apart: `see`
 * names an id by field, `@id` names one by prose, and a link — or an embed —
 * names a file by address. Three sentences about one relationship, and one
 * record doing two of them is one source with two ways.
 *
 * WHAT IS NOT HERE is a single decision about meaning: a mirror writes
 * nothing (it is a placement, not a claim), a `#topic` is not a mention (only
 * the `@` half of a tag is a name), a record never refers to itself, and what
 * is put away is left out at the read. Those are the READING's rulings
 * ({@link ./backlinks.ts}), asked of this index the way every other reverse
 * index of this format is read.
 */

import { type Address, addressOf, printAddress } from "./address.ts"
import { writtenTags } from "./derive.ts"
import { type Face } from "./document.ts"
import { linksIn } from "./documents.ts"
import { type Claims } from "./kinds.ts"
import { isRegular, type Located } from "./node.ts"

/** The ways the references reading knows, in the order a source says them:
 *  the edge somebody wrote with a verb first, then the prose they wrote after
 *  it. A schema's worth of vocabulary, kept as a plain list here because the
 *  wire's schema lives beside the reading ({@link ./backlinks.ts}); this
 *  module files under the SAME closure and has no Schemas of its own. */
export const WAYS = ["see", "mention", "link"] as const
export type Way = (typeof WAYS)[number]

/**
 * ONE TARGET A DOCUMENT WRITES TO — the key it files under, the way it was
 * named, and the record that did the naming when there is one. A body's
 * targets carry no record: a `.md` has no finer grain than itself.
 */
export interface Contribution {
  /** The key to file under — {@link printAddress} of the target, or the
   *  written `@mention` — the same spellings the reading will ask. */
  readonly key: string
  readonly way: Way
  /** The record, for an outline. Undefined for a body, whose every
   *  contribution carries no record — a `.md` is its own source. */
  readonly at: Located | undefined
  /** The target ADDRESS for the LINK way — what the index's heading rule
   *  decides by (a link onto a heading or a row points at the document as
   *  well). Absent for the field and prose ways, which file under one key
   *  only. */
  readonly address?: Address
}

/**
 * WHAT ONE DOCUMENT CONTRIBUTES to the index: one {@link Contribution} per
 * written target, in the order the document writes them.
 *
 * THE FOLD IS WHERE THE PROSE IS READ INTO THE INDEX: {@link linksIn} and
 * {@link writtenTags} are the readings the faces are built by, and a record's
 * title, its note, its `see` and its `@` tags are each read ONCE here instead
 * of once per page per revision at the read.
 *
 * A BODY contributes what its face already carries — every link it writes is
 * a `link`, every `@` tag it writes a `mention` — so the fold reads a body's
 * prose exactly once, with the face.
 */
export const contributionsOf = (
  claims: Claims,
  face: Face,
  records: ReadonlyArray<Located> | undefined,
): ReadonlyArray<Contribution> => {
  const found: Array<Contribution> = []
  if (records === undefined) {
    for (const link of face.links) {
      found.push({ key: printAddress(link), way: "link", at: undefined, address: link })
    }
    for (const tag of face.tags) {
      if (tag.charAt(0) !== "@") continue
      found.push({ key: tag, way: "mention", at: undefined })
    }
    return found
  }
  for (const located of records) {
    if (!isRegular(located)) continue
    for (const id of located.node.see ?? []) {
      const address = addressOf(claims, null, id)
      if (address === null) continue
      found.push({ key: printAddress(address), way: "see", at: located, address })
    }
    for (const address of linksIn(claims, located.file, located.node.title)) {
      found.push({ key: printAddress(address), way: "link", at: located, address })
    }
    if (located.node.desc !== undefined) {
      for (const address of linksIn(claims, located.file, located.node.desc)) {
        found.push({ key: printAddress(address), way: "link", at: located, address })
      }
    }
    for (const tag of writtenTags(located.node)) {
      if (tag.charAt(0) !== "@") continue
      found.push({ key: tag, way: "mention", at: located })
    }
  }
  return found
}