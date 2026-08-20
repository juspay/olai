/**
 * PIN THIS, UNPIN THIS — one gesture over one address, and the line it speaks
 * on when there is no row to hang one under.
 *
 * ## Why it is one verb and not two
 *
 * Every door onto the shelf is a TOGGLE, because what a reader means by "pin"
 * is a state rather than an event: the `•••` entry, the ⌘⇧P chord and the ⌘K
 * row each look at one address, ask the shelf whether it already holds it, and
 * send the write that changes the answer. Two verbs would be two affordances a
 * reader has to choose between while looking at a row that already says which
 * one applies.
 *
 * WHO ASKS is the door, and it hands the answer over ({@link togglePin}'s
 * `already`): a door draws its own label from it, and a chord reads it to know
 * whether this press asks for a name first (`./naming.ts`) — so asking again
 * here would be a third walk of the shelf for one press.
 *
 * Which write that is, is the shelf's storage read backwards (`./pins.ts`):
 * pinning is a `pin` — one op at the write gate, resolved against the set
 * because which file the shelf is is a fact about the directory — and
 * unpinning is `archive` of the pin's OWN node, which is the removal the set
 * already has. Neither is a verb this face invented.
 *
 * ## The line
 *
 * A refusal has to be read (HACKING.md), and two of the three doors are pressed
 * with nothing on screen to draw one under: a chord is pressed at whatever the
 * reader is looking at, and the shelf may not even be drawn yet. So the sentence
 * goes to the ONE place this app already puts what a gesture with no row said —
 * the line under the header (`../edit/UndoSaid.tsx`), which exists for ⌘Z for
 * exactly this reason.
 *
 * A MODULE-LEVEL line, in the shape this client already keeps app-wide
 * preferences in (`../layout/prefs.ts`): two surfaces write it — a chord
 * dispatched in the palette's window listener, and the shelf's own controls —
 * and one draws it. A context would be the same singleton with a provider
 * around it and a prop through the app.
 */

import { type Accessor, createRoot } from "solid-js"

import type { Said, Undo } from "../edit/undoing.ts"
import { hrefOf, type Route } from "../routes.ts"
import { createSaying } from "../saying.ts"
import { applying } from "../writes.ts"
import type { Pin } from "./pins.ts"

/**
 * The line, and the one thing about it that is not `../saying.ts`'s: it has no
 * OWNER.
 *
 * Every other said-line in this client belongs to a surface — a row, a panel, a
 * page — and dies with it, which is what `createSaying` is built around. This
 * one outlives all of them by construction: it is written by a chord dispatched
 * in a window listener and by the shelf's own controls, and read under the
 * header, so there is no component whose lifetime it has. `createRoot` is what
 * gives it an owner anyway — the app's, in effect — so the dwell's timer is
 * torn down by the same rule every other line's is rather than by nobody.
 *
 * ONE RECEPTACLE for how long a sentence lingers, which is the claim
 * `claims.test.ts` sweeps: the three rules and the countdown are `../saying.ts`'s
 * for every surface here, and a fourth hand-rolled copy of them is exactly what
 * that sweep exists to catch.
 */
const line = createRoot(() => createSaying())

/** What the last pin gesture had to say — drawn under the header, beside what
 *  ⌘Z has to say, because both are gestures with no row of their own. */
export const pinSaid: Accessor<Said | null> = line.said

/** Say it, for the dwell every said-line in this client keeps. */
export const sayPin = (message: Said | null | void): void => line.say(message)

/**
 * Put this address on the shelf, or take it off — and answer with whatever
 * there is to say, which the caller draws where it makes sense.
 *
 * ANSWERS rather than says, so the door decides: a row chosen in the ⌘K
 * palette has that panel's own line in front of the reader, and a chord has
 * nothing but {@link sayPin}.
 */
export const togglePin = async (
  route: Route,
  /** The pin this page ALREADY has, or `undefined` — which way this address's
   *  answer goes is a fact about the DIRECTORY, resolved by the door
   *  (`./pins.ts`'s `pinnedAt`, over the shelf the tab holds in
   *  `./answered.tsx`). Handed IN rather than asked here because the same
   *  door has already asked: the ⌘K row draws its label from this answer, and
   *  the chord reads it to know whether this press asks for a name first
   *  (`./naming.ts`). One walk of the shelf per gesture, not three. */
  already: Pin | undefined,
  record: Undo["record"],
): Promise<Said | undefined> =>
  already === undefined
    ? applying({ verb: "pin", at: hrefOf(route) }, record)
    : applying({ verb: "trash", id: already.id }, record)
