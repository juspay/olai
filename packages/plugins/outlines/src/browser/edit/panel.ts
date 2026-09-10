/**
 * The panel's pure half: what its button says, and what identifies it.
 *
 * The same split every surface it serves already has — `../date/pick.ts` beside
 * `../date/DatePicker.tsx`, and `../props/editor.ts` beside the chip run that
 * spends it: the rules a person can get wrong live in a function with a test,
 * and what is left in the component is a form. It matters at the shell too, and
 * for one more reason than taste: the pure modules CALL {@link pressOf}, and a
 * `.ts` reaching into a `.tsx` for a value is a unit test loading a JSX runtime
 * to ask what a button says.
 */

/**
 * The button, as the two things a reader can see about it.
 *
 * ONE declaration for the surfaces that have a button, and it is one because
 * the two halves are one question. Each derives its own answer — `pressOf` in
 * each pure module — and each used to declare this pair for itself, which is
 * the same concept written three times with nothing holding the three together.
 * (Three, then: the property editor was the third, and it has no button any
 * more — a chip commits on Enter.)
 *
 * They are derived TOGETHER at each site for a reason worth keeping beside the
 * type: the date picker shipped them as two functions, and they disagreed —
 * an undated node's empty box read `Clear date`, over a node with no date to
 * clear, beside a button that was correctly dead.
 */
export interface Press {
  /** What it says — which is the VERB, so the words are the ones the `•••`
   *  menu uses for the same edit. */
  readonly label: string
  /** Whether pressing it would ask the directory for anything. `false` draws
   *  it dead. */
  readonly writes: boolean
}

/**
 * What the button IS, over the value a node stores and the one a control
 * holds — for the two panels whose control offers ONE value.
 *
 * The rule is one rule and it was written twice, three words apart: an empty
 * control over a node that stores nothing writes nothing and says the verb it
 * came for; an empty control over a node that stores something is the CLEARING
 * verb, in the `•••` menu's own words, so the panel absorbs that gesture rather
 * than adding a second spelling of it; anything else writes exactly when it
 * differs from what is stored. The two spellings differed only in the words,
 * which is what `verbs` is.
 *
 * DERIVED TOGETHER, which is the reason this returns a pair rather than
 * answering two questions: the date picker shipped them as two functions and
 * they disagreed — an undated node's empty box read `Clear date`, over a node
 * with no date to clear, beside a button that was correctly dead.
 *
 * "Dead" is the EDITOR's own rule one surface along ({@link ./draft.ts}: a
 * commit that would change nothing sends nothing), never a fence on what may be
 * WRITTEN — the ops layer would take either value from an agent, and what is
 * refused here is a gesture that would produce no write at all.
 *
 * THE PROPERTY EDITOR IS NOT ONE OF THEM ANY MORE, and the absence is worth a
 * line because it used to be. It is a chip you type in now
 * (`../props/PropsDrawer.tsx`), with no panel and no button: Enter commits,
 * Escape cancels, and what a commit would WRITE is still a pure question with a
 * test — `writes` rather than a `pressOf`, since there is no label to derive
 * ({@link ../props/editor.ts}).
 */
export const pressOf = (
  stored: string | undefined,
  chosen: string,
  verbs: { readonly set: string; readonly clear: string },
): Press =>
  chosen === ""
    ? { label: stored === undefined ? verbs.set : verbs.clear, writes: stored !== undefined }
    : { label: verbs.set, writes: chosen !== stored }

/** The four testids one panel carries. A record rather than four props for the
 *  reason the shape is a record anywhere else: they are one panel's identity,
 *  named once at the call site off `../testids.ts`, rather than four arguments
 *  a caller can pass in the wrong order. */
export interface PanelIds {
  readonly panel: string
  readonly set: string
  readonly cancel: string
  /** The line that keeps the panel open saying what the ops layer said. */
  readonly said: string
  /** What the panel says about a stored value its control cannot hold — which
   *  is the two pickers' case and nobody else's now. */
  readonly notice?: string
}
