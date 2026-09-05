/**
 * NAMING A PIN — which gesture asks for one, and what an answer writes.
 *
 * ## Why the app asks at all, and why only there
 *
 * Every address already has a name: a node's own live title, a file's filename,
 * the word *Agenda* (`../address/address.ts`'s `nameOf`). A pin drawn from one
 * of those cannot go stale, which is the whole of the shelf's storage argument
 * — so the app writes a BARE address and asks nothing.
 *
 * A query is the one part of an address nothing in the set can name. Narrow the
 * agenda to `is:todo #home` and the door is still called *Agenda*, with the
 * filter beside it; keep three of them and the shelf is three rows called
 * *Agenda*. That is exactly where "a saved search" stops being a pin you can
 * read — and it is the moment the thought arrives, with the caret in the filter
 * box. So the ONE page this asks about is a page that carries a query and is
 * not already on the shelf ({@link namingFor}); everything else pins in one
 * press, exactly as it always did.
 *
 * ## The rules an answer is judged by
 *
 * **Enter with nothing is the bare pin.** Not a default name, and the
 * difference is the format's own: a *derived* name copied into the file is the
 * second answer the mirror argument exists to refuse. So an empty box writes
 * the address this app has always written, one keystroke from where the reader
 * already is — and the box wears the derived name as its PLACEHOLDER, so what
 * "nothing" means is a thing you can see.
 *
 * **Escape writes nothing at all.** The question is up BEFORE the write, so
 * backing out of it is backing out of the pin — which is what Escape means at
 * every other layer in this app. Pinning unnamed is Enter, which is less than
 * Escape; there is nothing a reader can lose by answering.
 *
 * **And the press that asked it is dead while it stands.** The chord is live in
 * the filter box, which is also where a hand is while it types a name, so a
 * second ⌘⇧P is a real thing to press by accident — and it used to ask the same
 * question again, which hands the box back its opening words
 * (`../palette/Palette.tsx`'s `pinPage`). A question is answered or backed out
 * of; nothing pressed elsewhere becomes its answer or writes past it.
 *
 * **A rename is `set_title` on the pin's own row**, which is the op an agent
 * would send and the one ⌘Z already takes back. Typing the name away writes the
 * bare address back, so one box does all three — name, rename, un-name.
 *
 * ## Where the asking happens
 *
 * In the ⌘K palette, which is this app's one surface for a command that asks
 * something first (`../palette/asking.ts`, the Trash's confirm): it owns the
 * caret, Escape, the focus trap, the said-line and the one-write-at-a-time
 * guard, and none of those wanted a second implementation in a sidebar column
 * four characters wide. What this module hands it is a `line` question like
 * any other — the words, and what an answer WRITES — so the palette's panel
 * knows nothing about a pin, and the next thing that wants a line typed there
 * is a function rather than a case in it.
 *
 * Both doors ask through {@link askName}: the shelf's rename control, which is
 * in a sidebar with no path to the panel, and the palette's own two (the chord
 * and the ⌘K row). One way in, and it is one write — the modal and the
 * question it is about cannot arrive on two different frames.
 */

import { PIN_NAME_UNWRITABLE, pinTitle } from "@olai/format"
import type { Edit } from "@olai/surface"
import { Result } from "effect"

import type { Line } from "../palette/asking.ts"
import { askInPalette } from "../palette/open.ts"
import { filterOf, hrefOf, type Route } from "../routes.ts"
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
  label: naming.kind === "pin" ? "Pin" : "Rename",
  question: naming.kind === "pin"
    ? "a name for this pin — Enter with nothing pins it unnamed"
    : "a name for this pin — Enter with nothing takes the name off",
  // WHAT NOTHING MEANS, shown rather than promised: the name this door takes
  // with an empty box.
  placeholder: naming.kind === "pin" ? naming.bare : naming.pin.bare,
  // …and what it starts holding: the name somebody WROTE, and nothing
  // otherwise — a derived name typed into the box would be a copy one Enter
  // away from being stored, which is the one thing the shelf's storage design
  // refuses.
  initial: naming.kind === "pin" || !naming.pin.written ? "" : naming.pin.name,
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
  if (naming.kind === "pin") {
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
    : Result.succeed({ verb: "title", id: naming.pin.id, title, was: naming.pin.title })
}

/**
 * The question this page's pin gesture raises, or `null` for the press that
 * simply writes.
 *
 * PURE over the two facts every door onto the shelf already holds — the route,
 * and whether the shelf already holds it — so which gesture asks is decided in
 * a unit test rather than in a key handler. Both doors ask it: the chord, to
 * know whether to toggle or to open the box, and the ⌘K row, to know whether
 * its label ends in the ellipsis this app puts on a verb that asks something
 * first.
 *
 * A page ALREADY ON THE SHELF is never asked, because that press is an UNPIN —
 * the toggle is one gesture over one address (`./pinning.ts`), and a question
 * raised over a row that is about to be removed would be asking about the
 * wrong thing entirely.
 */
export const namingFor = (
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
  filterOf(route) !== "" && already === undefined
    ? { kind: "pin", at: hrefOf(route), bare }
    : null

/** Ask for a name in the ⌘K palette, opening it if it is not up — the one door
 *  onto the question, whichever control pressed it. */
export const askName = (naming: Naming): void => askInPalette(askingFor(naming))
