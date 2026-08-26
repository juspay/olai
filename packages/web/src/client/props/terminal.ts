/**
 * WHAT A `terminal` CHIP SHOWS — the reading, as a pure function.
 *
 * The door hangs off the PROPERTY, so this is asked once per chip on every
 * frame of every row that carries one, and it is a module with a test beside it
 * for `./door.ts`'s reason: it is a handful of decisions with an order between
 * them, and that is the shape that goes quietly wrong inside a component.
 *
 * ## Three answers, and the first one is not a dot
 *
 *   - HOLLOW. There is no padi — this olai is not connected to a kolu, or the
 *     one it found speaks a contract it cannot. The chip wears an empty ring
 *     and SAYS SO IN WORDS, and it is the state this whole module is arranged
 *     around: "we cannot see" must never be drawn as "we looked and it is
 *     quiet". A gray dot for an unreachable padi would be a lie told once per
 *     lane, and the person reading it would act on it.
 *   - A DOT. There is a padi and the fleet has this terminal: the face the
 *     server already folded (`@olai/kolu-client`'s `face.ts`), read
 *     straight off the row. Nothing is re-derived here — a browser that folded
 *     agent states for itself would be the second switch kolu's own vocabulary
 *     exists to prevent, one wire further out.
 *   - GONE. There is a padi, and it does not have this terminal. A hollow ring
 *     too, but a DIFFERENT sentence: the property is still a true record of
 *     where the work happened, and the honest thing to say is that the
 *     terminal has been retired — not to draw a gray dot implying it is
 *     sitting there idle, and not to draw the no-padi hollow implying olai
 *     cannot see.
 *
 * ## Why `gone` and `hollow` look alike and read differently
 *
 * Both are rings rather than discs, because both mean "no live state here".
 * What separates them is the WORDS, and that is deliberate: a shape carries
 * "there is nothing to report" and the sentence carries why. Giving them two
 * shapes would put the burden on a reader to remember which ring meant which;
 * giving them one sentence would lose the distinction that decides what you do
 * next.
 */

import type { DotFace } from "@olai/surface"
import type { FleetTerminal, KoluLink } from "@olai/surface"

/** What the chip draws. `face` is what the dot LOOKS like; `says` is what a
 *  pointer and a screen reader are told, and it is always a whole sentence —
 *  a status glyph with no words is the thing this design is replacing. */
export interface TerminalReading {
  readonly face: DotFace
  /** Is the ring hollow — no live state to report, for either of the two
   *  reasons. Kept as its own field rather than derived from `face` at each
   *  draw, because "hollow" is a paint decision and `gone` is a fact. */
  readonly hollow: boolean
  readonly says: string
  /** The fleet row behind the dot, where there is one. What the snapshot pane's
   *  header draws — the repo, the branch, the intent — and `undefined` for
   *  every hollow. */
  readonly row?: FleetTerminal
}

/** The sentence a hollow chip carries when there is no padi at all. It names
 *  the socket, because "looked where?" is the first thing a person asks and
 *  the whole of what makes the state actionable. */
export const noPadiSays = (link: KoluLink): string => {
  if (link.status === "skew") {
    return `kolu at ${link.socket} speaks padi ${link.surfaceVersion ?? "?"}, and this olai speaks ${link.speaks} — one of the two needs an upgrade.`
  }
  // NO SOCKET AT ALL is the UNWIRED case, and it gets a sentence of its own
  // rather than the naming one with a blank where the path goes. Two readers
  // reach it: a run drawn outside the fleet provider (`./fleet.tsx`'s standing
  // hollow — a document's frontmatter, a test that mounts a chip) and a server
  // in the first instant of its life, before the dial has answered. "olai
  // looked at ." is not a sentence, and it would send a reader hunting for a
  // path that is not there.
  if (link.socket === "") return "olai is not watching a padi here."
  return link.told
    ? `no padi is answering at ${link.socket}, which is where $PADI_SOCKET points.`
    : `no padi is running — olai looked at ${link.socket}.`
}

/** What one `terminal` value reads as, given the link and the fleet. */
export const readingOf = (
  value: string,
  link: KoluLink,
  fleet: (id: string) => FleetTerminal | undefined,
): TerminalReading => {
  // THE LINK IS ASKED FIRST, and that order is the module's one real rule. An
  // empty fleet is what a healthy kolu with nothing open also has, so a chip
  // that looked the terminal up first would draw `gone` for every lane on a
  // laptop that simply is not running kolu.
  if (link.status !== "connected") {
    return { face: "gone", hollow: true, says: noPadiSays(link) }
  }
  const row = fleet(value)
  if (row === undefined) {
    return {
      face: "gone",
      hollow: true,
      says: "this terminal is no longer in the fleet — it has been closed or retired.",
    }
  }
  return { face: row.face, hollow: false, says: saysOf(row), row }
}

/** The sentence a live dot carries — the face, plus the two facts that make it
 *  worth pointing at (what the terminal is FOR, and where it is). */
const saysOf = (row: FleetTerminal): string => {
  const what = FACE_SAYS[row.face]
  const where = row.branch ?? row.repo ?? row.cwd
  const why = row.intent
  // Built by parts rather than by template, because every one of the three is
  // legitimately absent — a plain shell in no repository with no intent is an
  // ordinary terminal, and a sentence with two dangling dashes in it is how a
  // reader learns to stop reading the tooltip.
  return [what, why, where === null ? null : `in ${where}`]
    .filter((part): part is string => part !== null && part !== "")
    .join(" · ")
}

/** One sentence per LIVE face. `gone` is not here: it has two sentences, both
 *  above, because the two ways of having no live state are the distinction
 *  this module is about. */
const FACE_SAYS: Record<Exclude<DotFace, "gone">, string> = {
  working: "working",
  awaiting: "waiting for you",
  parked: "nothing running",
}
