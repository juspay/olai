/**
 * WHAT A `terminal` PROPERTY SHOWS — the reading, as a pure function.
 *
 * The door hangs off the PROPERTY, so this is asked once per row that carries
 * one, on every frame, and it is a module with a test beside it for
 * `./door.ts`'s reason: it is a handful of decisions with an order between
 * them, and that is the shape that goes quietly wrong inside a component.
 *
 * ## Two answers, and the second one is words
 *
 *   - A ROW. There is a padi and the fleet holds this terminal, so what comes
 *     back is the row kolu's own Dock would draw for it — folded once on the
 *     server, in kolu's own vocabulary (`@olai/kolu-client`), and read straight
 *     off the wire here. NOTHING IS RE-DERIVED IN THE BROWSER: a second fold
 *     over kolu's state vocabulary is the defect kolu's `agentProjection.ts`
 *     spends a page on, and putting the second copy across a wire would make it
 *     invisible as well as duplicated.
 *   - WORDS. There is no row, and the reason is a whole sentence rather than a
 *     shape. This is the state the module is arranged around, and it is three
 *     different facts that must never be drawn as one:
 *
 *       · **no padi** — this olai is not connected to a kolu at all. "We cannot
 *         see" must never be drawn as "we looked and it is quiet".
 *       · **skew** — something IS serving that socket and this build cannot
 *         speak to it. The opposite fix from the one above, so the opposite
 *         sentence: two builds disagree, and here are the versions.
 *       · **gone** — there is a padi, and it does not hold this terminal. The
 *         property is still a true record of where the work happened; the
 *         honest thing is to say the terminal was closed or retired.
 *
 * ## Why the answer is a sentence and not a face
 *
 * It used to be a face — a hollow ring with a tooltip — and the fifth Löwy
 * sitting retired the whole vocabulary it belonged to: olai does not invent
 * visual language for kolu's fleet any more, it draws kolu's row. What is left
 * for olai to say is exactly what kolu has no way of saying, which is why there
 * is no row to draw. That is prose, and prose is what a block has room for.
 */

import { resolveTerminal } from "olai-plugin-kolu/appliance/wire"
import type { FleetTerminal, KoluLink } from "olai-plugin-kolu/appliance/wire"

/** What one `terminal` value reads as: the row, or the reason there is none. */
export interface TerminalReading {
  /** The row the block draws, when the value resolves to a terminal the fleet
   *  holds. `undefined` for every one of the three answers below it. */
  readonly row?: FleetTerminal
  /** Why there is no row — a whole sentence, always, and the only thing drawn
   *  in the row's place. A status glyph with no words is what this design
   *  replaced; a blank where a row would be is the same mistake with less ink. */
  readonly says: string
}

/** The sentence when there is no padi at all. It names the socket, because
 *  "looked where?" is the first thing a person asks and the whole of what makes
 *  the state actionable. */
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
  fleet: ReadonlyMap<string, FleetTerminal>,
): TerminalReading => {
  // THE LINK IS ASKED FIRST, and that order is the module's one real rule. An
  // empty fleet is what a healthy kolu with nothing open also has, so a reading
  // that looked the terminal up first would say "retired" for every lane on a
  // laptop that simply is not running kolu.
  if (link.status !== "connected") return { says: noPadiSays(link) }
  // RESOLVED, not looked up. The board writes eight-character prefixes far
  // more often than whole uuids, and a map read answered `undefined` for every
  // one of them — a working terminal drawn as retired, which is what the human
  // found in production. `@olai/surface`'s `resolveTerminal` is the same
  // reading the server does, which is what keeps this and the snapshot from
  // disagreeing about which terminal a value is about.
  const found = resolveTerminal(value, fleet.keys())
  if (found.kind === "many") {
    return {
      // THE COUNT, because it is what makes the next move obvious: write more
      // of the id. A row for whichever terminal sorted first would be a live
      // green row about a terminal this value never named.
      says: `this names ${found.count} terminals — write more of the id to say which.`,
    }
  }
  const row = found.kind === "one" ? fleet.get(found.id) : undefined
  if (row === undefined) {
    return { says: "this terminal is no longer in the fleet — it has been closed or retired." }
  }
  return { row, says: "" }
}
