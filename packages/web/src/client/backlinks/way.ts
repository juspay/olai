/**
 * The two WAYS a record can refer to this node, as values: what each row is
 * called on screen, and what it is called to the browser tests.
 *
 * `../edges/relation.ts` for the other direction, and for the same reason that
 * file gives: `EdgeRefs.tsx` was once two components spelling their own label
 * and their own testid, and what the copy FRAGMENTED was worse than the copy —
 * the row's words are facts about a RELATION, so renaming one left both
 * components saying the old thing with everything still compiling. This section
 * had reopened exactly that, one direction over: the labels sat in JSX, the
 * testids were picked one by one beside them, and the browser steps mapped a
 * reader's word to a testid in a third place.
 *
 * KEYED BY `Way`, which is `@olai/format`'s own closed list — so the table is
 * total BY CONSTRUCTION and, unlike `relation.ts`'s, the closure is enforced
 * ACROSS the package boundary: a third way added where the rulings live
 * (`format/src/backlinks.ts`) is a compile error here, at the one place that
 * would otherwise have gone on drawing two rows out of three.
 *
 * PURE, and no component — `relation.ts`'s rule, for its reason: what a row is
 * called has to be decidable somewhere a test can ask without a browser.
 */

import { type Way, WAYS } from "@olai/format"

import { type TestId, TESTID } from "../testids.ts"

/** One way, as this page says it. */
export interface Referring {
  readonly way: Way
  /** The label on the row of links (`../NodeRefs.tsx`). A PHRASE about the
   *  referrer rather than the format's field name — the row reads left to
   *  right as a sentence, "sees this · order the new cabinets", and one of the
   *  two ways is not a field at all. */
  readonly label: string
  /** What that row is called to the browser tests, here rather than at the call
   *  site for `relation.ts`'s reason: one contract about one way, and a
   *  projection spelled per caller is one that drifts. */
  readonly refs: TestId
}

const REFERRING: Record<Way, Referring> = {
  see: { way: "see", label: "sees this", refs: TESTID.backlinkSeeRefs },
  mention: { way: "mention", label: "mentions this", refs: TESTID.backlinkMentionRefs },
}

/** The descriptor for one way — total, so a caller holding a {@link Way} never
 *  has to handle "not found". */
export const referring = (way: Way): Referring => REFERRING[way]

/** Both of them, in the order the section draws them — the format's own order
 *  ({@link WAYS}: the edge first, the prose after it), read rather than
 *  re-declared, so the rows and a referrer's own `ways` cannot come out in two
 *  different orders on one page. */
export const REFERRINGS: ReadonlyArray<Referring> = WAYS.map(referring)
