/** Per-conversation folds state, created by the conversation UI owner.
 * It survives folding within this tab activation and leaves with that owner. */

import { createSignal } from "solid-js"

export const diffKey = (call: string, at: number, path: string): string =>
  `${call}\u0000${at}\u0000${path}`


export const createFolds = () => {
const [unfolded, setUnfolded] = createSignal<ReadonlySet<string>>(new Set())

/** Is this one open? */
const isUnfolded = (id: string): boolean => unfolded().has(id)

/**
 * The name of ONE BLOCK of change inside one call: the call, WHERE IN THAT
 * CALL'S REPORT the block arrived, and the file it is about. It is what the
 * fold is remembered under and what the list drawing the blocks is keyed by —
 * one string, minted once ({@link ./ToolFrame.tsx}), so a block cannot be one
 * thing to the fold and another to the list.
 *
 * All three parts are needed and no two are enough. One call can rewrite
 * several files — an agent editing a module and its test — so the call alone
 * would open and close them together; one file is edited again in a later turn,
 * so the path alone would come up open in a call the reader has not seen yet;
 * and **one call reports several blocks about the SAME file**, which is what
 * the position is here for and is why this signature grew one.
 *
 * That last one is not a corner case. An `Edit` is reported twice, and the
 * second report is built by the adapter out of the patch the tool actually
 * made — one `diff` block per HUNK, every one of them carrying the same path
 * (`toolUpdateFromDiffToolResponse`, adapter 0.73.0). So an edit that landed in
 * three places arrives as three blocks under one name, and a key made of the
 * call and the path alone called all three of them the same thing.
 *
 * The POSITION is the only honest identity a hunk has: it carries no id of its
 * own, and its content is not one either — `replace_all` across three identical
 * sites produces three blocks equal field for field.
 *
 * Joined by a separator that can occur in none of the parts, and spelled as an
 * ESCAPE rather than typed: a control character in the source makes the whole
 * file binary to git — which is what the first draft of this line did, and a
 * file nothing can diff or blame line by line is a worse price than any key.
 */
const toggleFold = (id: string): void => {
  setUnfolded((open) => {
    const next = new Set(open)
    if (!next.delete(id)) next.add(id)
    return next
  })
}

return { isUnfolded, toggleFold }
}
