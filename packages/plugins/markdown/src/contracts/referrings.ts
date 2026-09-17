/**
 * THE WAYS a record or a document can refer to a document, as this page says
 * them — the sibling of the outlines plugin's `referrings.ts`, which holds
 * the same three ways for a node's page.
 *
 * The ways themselves are `@olai/format`'s closed list (`WAY`: an edge
 * somebody wrote, a word in prose, a link in a body or note). What EACH page
 * supplies is the drawing of one way — the label on its row, and the testid
 * that row answers to — because the two pages are different plugins and may
 * not import each other. The labels are the shared ones ("sees this",
 * "mentions this", "links this"), kept identical here by hand: renaming a way
 * in one place is a deliberate, visible edit, not a drift.
 *
 * KEYED BY `Way`, total by construction for the outlines' file's reason: a
 * fourth way added to the format's list is a compile error at this table too.
 */
import type { AnyTestId as TestId } from "@olai/ui-primitives/testids.ts"
import { TESTID } from "olai-plugin-markdown/testids"
import { type Way, WAYS } from "@olai/format"

/** One way, as this page says it. */
export interface ReferringDocument {
  readonly way: Way
  /** The label on the row of links — the same reader's sentence the outlines
   *  plugin's table uses, so the two sections read alike. */
  readonly label: string
  /** What that row is called to the browser tests. */
  readonly refs: TestId
}
const REFERRING: Record<Way, ReferringDocument> = {
  see: { way: "see", label: "sees this", refs: TESTID.documentSeeRefs },
  mention: { way: "mention", label: "mentions this", refs: TESTID.documentMentionRefs },
  link: { way: "link", label: "links this", refs: TESTID.documentLinkRefs },
}

/** All of them, in the order the section draws them — the format's own order,
 *  READ rather than re-declared (the outlines file's argument). */
export const REFERRING_DOCUMENT: ReadonlyArray<ReferringDocument> = WAYS.map((way) => REFERRING[way])