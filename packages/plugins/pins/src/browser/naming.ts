/**
 * Pin naming uses the palette's owned question and write guard.
 * Filtered pages may be unnamed; layouts always require a written name.
 * Escape writes nothing. Repeated commands preserve the pending question.
 * Rename edits only the shelf row, preserving its exact address and checking
 * the original title so a concurrent edit cannot be overwritten.
 */
import { PIN_NAME_UNWRITABLE,pinTitle } from "@olai/format"
import type { Edit } from "@olai/surface"
import { Result } from "effect"

import type { Line } from "olai-plugin-navigation/palette-asking"
import { askInPalette } from "./box.ts"
import type { Route } from "olai-plugin-navigation/routes"
import type { Routing } from "olai-plugin-navigation/routes"
import type { Pin } from "./pins.ts"

/** WHICH pin a name is being asked for — the page about to become one, or the
 *  row already on the shelf. Two arms because they write two different ops, and
 *  one type because everything between the question and the write is the
 *  same. */
export type Naming =
  | {
    readonly kind: "pin"
    /** The address to pin, as this app spells it. */
    readonly at: string
    /** What the page is called with no name on it — the placeholder. */
    readonly bare: string
  }
  | { readonly kind: "layout"; readonly at: string; readonly panes: string }
  | { readonly kind: "rename"; readonly pin: Pin }

/**
 * The question this naming raises — a `line` like any other the palette can
 * ask (`../palette/asking.ts`), carrying what an answer WRITES rather than
 * what it is about.
 *
 * Resolved in ONE place so the two arms cannot drift into two different
 * promises about what an empty box does, and closed over the {@link Naming}
 * rather than handing it across: the panel draws a question, and which pin
 * this one is about is nobody's business but this module's.
 */
export const askingFor = (naming: Naming): Line => ({
  kind: "line",
  label: naming.kind === "rename" ? "Rename" : "Pin",
  question: isLayout(naming) ? "a name for this layout — Escape backs out" : naming.kind === "pin"
    ? "a name for this pin — Enter with nothing pins it unnamed"
    : "a name for this pin — Enter with nothing takes the name off",
  // WHAT NOTHING MEANS, shown rather than promised: the name this door takes
  // with an empty box.
  placeholder: naming.kind === "layout" ? naming.panes : naming.kind === "pin" ? naming.bare : naming.pin.bare,
  // …and what it starts holding: the name somebody WROTE, and nothing
  // otherwise — a derived name typed into the box would be a copy one Enter
  // away from being stored, which is the one thing the shelf's storage design
  // refuses.
  initial: naming.kind !== "rename" || !naming.pin.written ? "" : naming.pin.name,
  resolve: (name) => namedEdit(naming, name),
})

/**
 * The WRITE an answered question sends — one op either way, or the sentence
 * saying why it cannot be spelled.
 *
 * The two arms compose in two places on purpose. A `pin` carries the name to
 * the server, which is the only side that knows which file the shelf is and
 * therefore the only side that can write the row in one op
 * (`@olai/surface`'s `edit.ts`); the refusal for a name a link cannot hold is
 * that resolver's, in `@olai/format`'s own words. A RENAME has a row already,
 * so the title is spelled here — with the same function, so the two cannot
 * disagree — and the refusal is spelled here too, because this is where the
 * writing happens.
 */
export const namedEdit = (
  naming: Naming,
  name: string,
): Result.Result<Edit, string> => {
  if (isLayout(naming) && name.trim() === "") return Result.fail("a layout needs a name")
  if (naming.kind !== "rename") {
    const named = name.trim()
    return Result.succeed(
      named === ""
        ? { verb: "pin", at: naming.at }
        : { verb: "pin", at: naming.at, name: named },
    )
  }
  // The address as the FILE holds it, never the one this app would mint for the
  // same page: a rename is about the name ({@link Pin.at}).
  const title = pinTitle(naming.pin.at, name)
  return title === undefined
    ? Result.fail(PIN_NAME_UNWRITABLE)
    : Result.succeed({ verb: "title", id: naming.pin.id, title, was: naming.pin.title, pinned: true })
}

/**
 * The question this page's pin gesture raises, or `null` for the press that
 * simply writes.
 *
 * PURE over the two facts every door onto the shelf already holds — the route,
 * and whether the shelf already holds it — so which gesture asks is decided in
 * a unit test rather than in a key handler. The ⌘K row asks it to decide
 * whether to open the box and whether its label ends in the ellipsis this app puts on a verb that asks something
 * first.
 *
 * A page ALREADY ON THE SHELF is never asked, because that press is an UNPIN —
 * the toggle is one gesture over one address (`./pinning.ts`), and a question
 * raised over a row that is about to be removed would be asking about the
 * wrong thing entirely.
 */
export const namingFor = (
  /** The app's URL grammar, handed in — see `./pins.ts`'s `pinsOf`. */
  routes: Routing,
  route: Route,
  /** The pin this page ALREADY has, as the caller resolved it — the same
   *  answer the door beside this one draws its label from, asked once
   *  (`./pins.ts`'s `pinnedAt`). */
  already: Pin | undefined,
  /** What this page is called — the placeholder, and the reason the caller
   *  passes it: what a NODE's page is called is a fact about the set, read off
   *  the focused page's own reading (`../reading.tsx`). */
  bare: string,
): Naming | null =>
  routes.filterOf(route) !== "" && already === undefined
    ? { kind: "pin", at: routes.href(route), bare }
    : null

/** Ask for a name in the ⌘K palette, opening it if it is not up — the one door
 *  onto the question, whichever control pressed it. */
export const askName = (naming: Naming): void => askInPalette(askingFor(naming))

const isLayout = (naming: Naming): boolean => naming.kind === "layout"
  || (naming.kind === "rename" && naming.pin.target.kind === "layout")
