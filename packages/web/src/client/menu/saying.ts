/**
 * RUNNING a verb, and keeping what it had to say about it.
 *
 * Not the menu. The panel is gone by the time most of these answers arrive —
 * choosing an entry shuts it — so this belongs to the ROW, beside the `•••`,
 * and it outlives every open and close the way `./door.ts` does. Splitting it
 * out of the panel's component is what makes that visible: `./NodeMenu.tsx`
 * holds the primitive, and this holds the one thing that is still true after
 * the primitive has put itself away.
 *
 * Every verb in the catalog does its thing, answers with a sentence about what
 * happened instead, or throws, and this is the one place a reader is told
 * about any of the three:
 *
 *   - **the SENTENCE is the ops layer's own, verbatim**, because it is the
 *     only one that carries a reason: a mark refused over finished work, a
 *     placement three other rows still name. Nothing here rewords it.
 *   - **the THROW is worded here**, and the clipboard is why there is one: it
 *     is refused whenever the page is not a secure context, which is every LAN
 *     reader on plain http. That failure used to be caught inside the action
 *     and dropped, so a copy that never happened was indistinguishable from
 *     one that did.
 *   - **the CAUSE is kept**, because a few seconds of sentence in a gutter
 *     cannot carry it and a reader who wants to know why has nowhere else to
 *     look. A clipboard the browser refused and a bug in this app's own
 *     href-building produce the same message on screen; they must not produce
 *     the same thing in a console.
 */

import { type Accessor, createSignal, onCleanup } from "solid-js"

import type { MenuAction } from "./action.ts"
import { type Said, SAID_MS } from "../edit/undoing.ts"

export interface Saying {
  /** What the last verb had to say, or `null`. */
  readonly said: Accessor<Said | null>
  /** Run one, and say so — whether it happened or not. */
  readonly pick: (action: MenuAction) => Promise<void>
}

/** Call it in the ROW's own owner, not the panel's: the timer has to be
 *  cleared with the row, and the line it drives is still on screen after the
 *  menu that started it has gone. */
export const createSaying = (): Saying => {
  const [said, setSaid] = createSignal<Said | null>(null)
  let clearing: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(clearing))

  const say = (message: Said): void => {
    setSaid(message)
    clearing = setTimeout(() => setSaid(null), SAID_MS)
  }

  return {
    said,
    pick: async (action) => {
      clearTimeout(clearing)
      setSaid(null)
      try {
        const answer = await action.run()
        if (answer !== undefined) say(answer)
      } catch (cause) {
        // The verb's own words, lower-cased into a sentence — so a further
        // action needs no entry here, and none of them can be forgotten.
        say({ tone: "alarm", text: `couldn't ${action.label.toLowerCase()}` })
        console.warn(`olai: "${action.label}" did not happen`, cause)
      }
    },
  }
}
