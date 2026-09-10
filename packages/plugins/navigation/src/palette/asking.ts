/**
 * A QUESTION THE PALETTE PUTS IN PLACE OF ITS LIST — the two shapes one can
 * take, and nothing about how either is drawn.
 *
 * A command that needs a second thing before it can run stays in the box the
 * reader chose it in: the list goes, the words appear where it was, and Enter
 * answers THIS rather than whatever the list would have taken. That is olai's
 * own chrome and not the browser's, for the reason every other panel here is —
 * a `window.confirm()` cannot say a sentence of its own inside.
 *
 * IT IS A VALUE, in its own leaf module, because three modules that must not
 * import one another all hold it: `./open.ts` (what the palette is showing),
 * `./Question.tsx` (how it is drawn) and whichever feature asked it
 * (`../pins/naming.ts` today). A question declared in any one of those would
 * make the other two depend on that feature.
 *
 * ## The two kinds, and the difference is WHO OWNS THE BOX
 *
 * A CONFIRM is a yes or a no about a write whose reach is bigger than the row
 * it was chosen on — `Move to Trash`, with the `•••` menu's sentence verbatim.
 * It leaves the box alone (a filter typed behind it is still there when the
 * question is backed out of) and takes the CARET onto its own button, because
 * the answer is a press and a question nobody's keyboard can reach is one only
 * a mouse may answer.
 *
 * A LINE is typed, so it OWNS the box: the palette's own input is where the
 * answer is written — the shape `+ a line` already taught — and the caret is
 * left exactly where it already is. While one stands, the box is not a filter
 * and not a prefix (`./items.ts`'s `Box`), which is what keeps an Enter aimed
 * at the question from being read as a capture.
 *
 * WHAT AN ANSWER MEANS is the asker's, carried as {@link Line.resolve}: this
 * module knows that a typed answer becomes one write or a sentence saying why
 * it cannot, and nothing else about it. So the next thing that wants a line
 * typed in the palette — a document renamed, a new outline named — is a
 * function, not an arm here and a case in the panel.
 */

import type { Edit } from "@olai/surface"
import type { Result } from "effect"

export type Asking = Confirm | Line

/** Ask before a write whose reach is bigger than the row it was chosen on. */
export interface Confirm {
  readonly kind: "confirm"
  /** The verb's own words, on the button that goes ahead. */
  readonly label: string
  readonly question: string
  readonly edit: Edit
}

/** Ask for a LINE, typed into the palette's own box. */
export interface Line {
  readonly kind: "line"
  /** The verb's own words, on the button that goes ahead. */
  readonly label: string
  /** The words above the box. */
  readonly question: string
  /** What the box holds greyed — what this door does with nothing typed, so
   *  "Enter with nothing" is a thing the reader can see rather than a promise. */
  readonly placeholder: string
  /** What the box starts holding. */
  readonly initial: string
  /**
   * What the typed answer WRITES — one op, or the sentence saying why it
   * cannot be spelled, which the palette draws in its own line and keeps the
   * question up for.
   *
   * Resolved when it is ANSWERED rather than when it was asked, because the
   * words do not exist yet at the asking.
   */
  readonly resolve: (text: string) => Result.Result<Edit, string>
}
