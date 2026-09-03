/**
 * WHAT DRESSES EACH LIVE PROPERTY — the three `outline.row.*` slots, read as
 * one lookup, and the ONE module that joins them.
 *
 * The seam (`./seam.ts`) is a lay-out and a set of rules and holds no table at
 * all now; that half of the arrangement got simpler rather than merely moving.
 * What changed is where the faces come from.
 *
 * ## It has been three things, and the third is the one that is right
 *
 * It was TWO SIDE-EFFECT IMPORTS — `import "./kolu-terminal/index.ts"` and
 * `import "./odu-ci/index.ts"` — each reaching a folder inside this package
 * that called `registerLive` at load. The argument written on those folders was
 * that they were "the app's own tree, registering the app's own table", and
 * that was exactly true while they were.
 *
 * It was then a WALK OVER THE MANIFESTS, registering what each declared. That
 * fixed the direction — a plugin reaching into this app's table would be the
 * import direction the whole extraction exists to make impossible — and left
 * one thing wrong: the walk was over the BUILD, so the table held faces for
 * plugins this serve was not running, and every read of it had to carry a
 * LICENCE asking whether it should be drawn.
 *
 * It is a READ OF THE SLOT TABLE now. A plugin registers its own faces from its
 * own fiber, through `ctx.slots`, and a plugin the roster does not name has no
 * fiber in this tab — so the table holds exactly what may be drawn and there is
 * nothing to license. This module does not register anything; it joins the
 * three slots into the one lookup the seam takes.
 *
 * ## Why the three are joined here and not in the seam
 *
 * Because a `Dressing` — a chip, its pane and a block, under one word — is this
 * app's shape and not the runtime's. The slots are three because they are three
 * PLACES on a row, and a plugin registers into whichever it means; the drawer
 * asks one question per value and wants one answer. Joining them anywhere else
 * would mean the seam knew there were slots, or the runtime knew what a
 * property row looks like.
 *
 * ## `../live/duration/` is not part of it
 *
 * ...and that is not an omission: the ⏱ chip is a live face with no property
 * key to hang off, so it registers nothing and is drawn by the row instead. Its
 * own header argues that in full, including what moving it onto the table would
 * take.
 */

import { dressed } from "../plugins/runtime.ts"

import type { Dressing, Dressings } from "./seam.ts"

/**
 * THE LOOKUP — one composed kind word in, whatever wears it out.
 *
 * REACTIVE by construction: `dressed` is tracked, so a caller reading this
 * inside a memo re-runs when a plugin arrives or leaves. That is why the seam
 * takes a function rather than a map — a map read once would pin whichever
 * answer the page happened to be built on, which for a tab that follows the
 * roster is a real state rather than a theoretical one.
 *
 * `undefined` for a word nothing dresses, which is most words: the vocabulary a
 * vault may declare is larger than the set of kinds anybody drew a face for,
 * and a property under an undressed kind draws exactly as it always did.
 */
export const DRESSINGS: Dressings = (word) => {
  const Chip = dressed("outline.row.chip").get(word)
  const Pane = dressed("outline.row.pane").get(word)
  const Block = dressed("outline.row.block").get(word)
  if (Chip === undefined && Pane === undefined && Block === undefined) return undefined
  // Spelled field by field rather than spread from a partial, so a fourth place
  // on a row is a type error here — this is the one join, and a slot nobody
  // read would be a face registered into silence.
  const dressing: Dressing = {
    ...(Chip === undefined ? {} : { Chip }),
    ...(Pane === undefined ? {} : { Pane }),
    ...(Block === undefined ? {} : { Block }),
  }
  return dressing
}
