/**
 * A row of the transcript, for the tests of the two faces drawn over one.
 *
 * `./spawn.ts`'s rail and `./elapsed.ts`'s readout are asked of the SAME row at
 * the same moment and are gated on the same two facts, so their tables were
 * built over two copies of one factory — identical down to the wording of the
 * comment above them, and already drifting: one carried a stamp and a running
 * status by default and the other carried neither, so a reader comparing the
 * two tables could not assume "same row". A shared skeleton is what makes that
 * assumption safe, and it is what a field added to `ChatEntry` now lands in
 * once rather than twice.
 *
 * THE SKELETON ONLY — the fields every row of this collection has. What a
 * particular rule is ABOUT stays in that rule's own test: the readout's rows
 * are running calls and the rail's are spawns, and a default that decided
 * either from out here would be a table whose subject is somewhere else. Two
 * other chat tests keep factories of their own (`./lanes.test.ts`,
 * `./order.test.ts`) and should: theirs take different arguments and answer
 * different questions, which is the difference between a shared shape and a
 * shared name.
 *
 * It carries no LIVENESS either, and that is a fact about the rules rather than
 * about this file: both faces are functions of the row now, because whether a
 * call is still going is a fact about the call's own turn and the server marks
 * it there (`stranded`). A conversation-wide answer used to be handed in beside
 * the row; it could not tell a dead turn's leftovers from a live turn's work.
 */

import type { ChatEntry } from "@olai/surface"

/** A tool row, as the transcript serves one. */
export const toolRow = (extra: Partial<ChatEntry> = {}): ChatEntry => ({
  id: "tool:agent-1",
  seq: 0,
  since: "2026-08-21T12:00:00.000Z",
  kind: "tool",
  text: "explore the outline",
  ...extra,
})
