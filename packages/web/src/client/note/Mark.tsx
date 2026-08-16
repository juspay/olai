/**
 * The pilcrow: a node has a note, and here is the door to it.
 *
 * A row is its title (`../settings/density.ts`), so the one thing a folded row
 * still has to say is that there is more — otherwise the whole outline is a
 * claim that nothing was ever written under any of it. This is that one thing,
 * and it is deliberately the smallest mark that could carry it: the typesetter's
 * own sign for "there is a paragraph here", dim beside the title, no box, no
 * count, no chevron.
 *
 * IT IS A `<button>`, and that is the keyboard half rather than a detail: a
 * button takes the caret with Tab and answers Space and Enter without this file
 * spelling either, which is the only focus a row has in this app — the editor's
 * caret is the other, and it belongs to the title's own input (`../keys.ts` says
 * why a bare key is never claimed on the window). So "space with the row
 * focused" is the platform's, and stays true the day this app grows a row-level
 * focus ring.
 *
 * The press STOPS, because the cell it sits in is the title's click-to-edit
 * target (`../NodeLine.tsx`): without that, opening a note would also drop a
 * caret in the line above it.
 *
 * It is ACCENTED while the row is open — the first of the open state's three
 * layers is the title line saying so (the tags brighten with it, `../styles.css`)
 * — and dim the rest of the time.
 */

import { TESTID } from "../testids.ts"

export function NoteMark(props: {
  readonly open: boolean
  readonly onToggle: () => void
  /** Handed to `./expand.ts`'s `setTrigger`: this button is the one control
   *  that opens the row and is NOT inside the box the click-away calls inside,
   *  so the dismissal has to be told about it by name. */
  readonly ref?: (el: HTMLButtonElement) => void
}) {
  return (
    <button
      ref={props.ref}
      type="button"
      // `shrink-0` so the mark never gives up width to an ellipsizing title —
      // it is the one thing on a folded row that must not be the part that
      // disappears. `leading-none` and the fixed width keep the baseline of the
      // line where it was whether or not a node carries a note.
      class="inline-flex w-3 shrink-0 cursor-pointer select-none justify-center border-0 bg-transparent p-0 align-baseline text-[0.8125rem] leading-none transition-colors duration-100 hover:text-accent focus-visible:outline-none focus-visible:text-accent"
      classList={{
        "text-accent": props.open,
        "text-muted/60": !props.open,
      }}
      data-testid={TESTID.noteMark}
      // The FACT, never the ink it is drawn in — the treatment every other
      // machine-read thing on a row gets.
      data-open={props.open ? "true" : "false"}
      aria-expanded={props.open}
      aria-label={props.open ? "close the note" : "open the note"}
      title={props.open ? "close the note" : "open the note"}
      onClick={(event) => {
        event.stopPropagation()
        props.onToggle()
      }}
    >
      ¶
    </button>
  )
}
