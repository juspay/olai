/**
 * What is folded FOR THIS READING — which is not the same question as what
 * this browser has folded.
 *
 * `./memory.ts` holds the second: a set of node ids this browser has collapsed,
 * kept per file, remembered across reloads and across tabs. It is a claim about
 * a TREE the reader was reading.
 *
 * A FILTER makes a different tree (`../filter/`), and inside that one a
 * collapse would hide the very match the query was typed to find — so while a
 * filter is on, nothing is folded. Nothing is written: the memory is untouched
 * and clearing the filter restores every collapse exactly as it was.
 *
 * IT IS ONE ANSWER BECAUSE FOUR THINGS READ IT. The tree draws rows from it
 * (`../Tree.tsx`); the editor walks it to find where `↑` and `↓` go, the
 * selection walks it to find what a shift-click spans, and the drag walks it to
 * find what a drop can land beside (`../edit/Editable.tsx`, which hands one
 * `collapsed` to all three). A reading the tree suspended and those three did
 * not would be a page whose arrow keys walked rows nobody can see.
 */

import { useNarrowed } from "../filter/narrowed.tsx"
import { collapsedNodes } from "./memory.ts"

/** Nothing folded — one value, shared, because every consumer of the accessor
 *  below memoises against it. */
const NONE: ReadonlySet<string> = new Set()

/**
 * The folds in force, as an accessor.
 *
 * A FACTORY rather than a bare function, and that is the one piece of mechanism
 * here: the narrowing arrives through a context, and a context may only be read
 * while a component is being set up. Three of the four consumers call the
 * accessor later — inside an event handler, with no owner to read a context
 * from — so it is read once, here, and closed over.
 */
export const createFoldReading = (): (() => ReadonlySet<string>) => {
  const narrowed = useNarrowed()
  return () => (narrowed.active() ? NONE : collapsedNodes())
}
