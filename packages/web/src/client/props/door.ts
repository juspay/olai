/**
 * A PROPERTY VALUE THAT NAMES A THING IS A LINK — this is where the answer
 * becomes one.
 *
 * ## What moved, and why this file is short now
 *
 * It used to ASK. Five shape guesses in an order, two lookups behind them, and
 * a rule about each — written before the vault could declare anything about a
 * key, and never taught to read a declaration once it could. That question is
 * answered where the set is (`@olai/format`'s `meaning.ts`, which argues the
 * whole subject and names the three bugs the second answer was causing), and a
 * page arrives carrying its ANSWERS: a doors table beside the names table,
 * keyed by the file a value was written in, its key and the value itself.
 *
 * So what is left here is the half that was always the browser's and could
 * never have been the format's: WHERE A CLICK GOES. An answer names a thing;
 * a route, a tab, a tooltip and a face are what this app makes of that, and
 * `@olai/format` has no routes in it.
 *
 * ## The one rule this file still keeps
 *
 * A door LOOKS LIKE A LINK and nothing else does. Everything the answer does
 * not name stays the text it always was, which is the founding rule read from
 * the drawing end: a wrong door is worse than no door, and a value with no
 * answer has earned no door.
 *
 * ## Length is not a refusal
 *
 * A value that names something is a door HOWEVER LONG IT IS. The DISPLAY has a
 * length rule — a long door is clamped to one line (`./PropsDrawer.tsx`'s
 * `Clamped`) — and it is a rule about pixels, applied after the answer has
 * arrived. Nothing here asks how long a value is.
 */

import type { Meaning } from "@olai/format"

import type { Names } from "../names.ts"
import { atFile, atNode, type Route } from "../routes.ts"

/**
 * WHAT A CHIP DRAWS FOR A VALUE THAT NAMES SOMETHING — where the click goes,
 * what the pointer is told, and which words the face wears.
 *
 * The four arms carry a ROUTE or an `href` rather than the answer, because
 * where a click goes is the whole point of turning one into this.
 */
export type Door =
  /** Somewhere in this app — a document of this directory, a node the set
   *  declares, or a day of the journal (which wears the date badge as well as
   *  opening). One arm for the three, because what differs between them is
   *  the route and the route is a value. */
  | (Drawn & { readonly kind: "document" | "node" | "day"; readonly route: Route })
  /** Somewhere that is not this app. Opens in a tab of its own. */
  | (Drawn & { readonly kind: "away"; readonly href: string })

/** What every door wears, whichever kind it is: the words on the chip, and
 *  what the pointer is told about them. */
interface Drawn {
  /** The words the chip DRAWS — the value verbatim, except where the vault
   *  declared it a reference. */
  readonly face: string
  /** What a pointer resting on it is told — see {@link doorFor}. */
  readonly says: string
}

/**
 * WHAT THE ANSWER OPENS — the mapping, and it is a total function of its
 * argument plus the one table a page already carries.
 *
 * `names` is read for exactly one thing: what a node this value points at is
 * CALLED. The page resolves every door's target into that table
 * (`@olai/format`'s `pageOf`), so a node door always finds its name there —
 * and an answer that somehow did not is drawn by its id, which is the honest
 * dead link every reader of that table already means by absence.
 *
 * ## The face, and the tooltip that is its other half
 *
 * THE FACE IS THE VALUE, in every arm but one. The words on a chip are the
 * record's words — the path as it was written, the URL as it was typed, the
 * date with the minute still on it — and a door has never been licence to
 * redraw them.
 *
 * THE ONE EXCEPTION IS A REFERENCE. `agent grok` reads `agent Grok`, because
 * the vault DECLARED `agent` a reference and a reference is a thing whose name
 * is not its identity; `titled` is that fact, decided where the declarations
 * are ({@link Meaning}) and never guessed at here. Then the STORED id is what
 * the pointer is told, so the value the record actually holds is one hover
 * away — which is the half somebody writing a `set_prop` needs, and the half a
 * title would otherwise take off the screen.
 *
 * `says` NAMES WHERE THE CLICK GOES, everywhere else: the resolved document,
 * the day, the address a tab would open. A GitHub reference is told its URL
 * rather than a sentence about GitHub, which is the same rule applied to the
 * one door whose value and destination are spelled differently.
 */
export const doorFor = (opens: Meaning, value: string, names: Names): Door => {
  switch (opens.kind) {
    case "away":
      return { kind: "away", href: opens.href, says: opens.href, face: value }
    case "day":
      return {
        kind: "day",
        // The route is written out here as the two other links to a day write
        // it (`../calendar/Day.tsx`, `../agenda/Day.tsx`): `/d/<ISO>` has no
        // constructor because a day carries a value and the named pages do not.
        route: { kind: "day", date: opens.date },
        says: `what is on ${opens.date}`,
        face: value,
      }
    case "document":
      return { kind: "document", route: atFile(opens.file), says: opens.file, face: value }
    case "node": {
      const named = names(opens.id)
      return {
        kind: "node",
        route: atNode(opens.id),
        // WHICHEVER HALF THE FACE IS NOT. A titled chip shows the name and is
        // told the id; an untitled one shows the value and is told the name.
        says: opens.titled ? opens.id : named?.title ?? opens.id,
        face: opens.titled ? named?.title ?? value : value,
      }
    }
  }
}
