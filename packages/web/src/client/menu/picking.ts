/**
 * RUNNING a verb from the menu, and saying what came of it.
 *
 * Not the menu, and not the line either. The panel is gone by the time most of
 * these answers arrive — choosing an entry shuts it — so this belongs to the
 * ROW, beside the `•••`, and it outlives every open and close the way
 * `./door.ts` does. How long the sentence then stays is not this file's
 * question: that is `../saying.ts`, which the Trash's own line rides on too.
 * What is left here is the one thing that IS the menu's — a catalog entry may
 * be attempted and may throw, and this is what happens when it does.
 *
 * Every verb does its thing, answers with a sentence about what happened
 * instead, or throws, and this is the one place a reader is told about any of
 * the three:
 *
 *   - **the SENTENCE is the ops layer's own, verbatim**, because it is the
 *     only one that carries a reason: a mark refused over finished work, a
 *     placement three other rows still name. Nothing here rewords it.
 *   - **the THROW is worded here**, and the clipboard is why there is one: it
 *     is refused whenever the page is not a secure context, which is every LAN
 *     reader on plain http. That failure used to be caught inside the action
 *     and dropped, so a copy that never happened was indistinguishable from
 *     one that did. Worded from the entry's own LABEL, so a further verb needs
 *     no entry here and none of them can be forgotten.
 *   - **the CAUSE is kept**, because a few seconds of sentence in a gutter
 *     cannot carry it and a reader who wants to know why has nowhere else to
 *     look. A clipboard the browser refused and a bug in this app's own
 *     href-building produce the same message on screen; they must not produce
 *     the same thing in a console.
 */

import type { Accessor } from "solid-js"

import type { MenuAction } from "./action.ts"
import type { Said } from "../edit/undoing.ts"
import { createSaying } from "../saying.ts"

export interface Picking {
  /** What the last verb had to say, or `null`. */
  readonly said: Accessor<Said | null>
  /** Run one, and say so — whether it happened or not. */
  readonly pick: (action: MenuAction) => Promise<void>
}

/** Call it in the ROW's own owner, not the panel's: the line is still on
 *  screen after the menu that started it has gone. */
export const createPicking = (): Picking => {
  const saying = createSaying()

  return {
    said: saying.said,
    pick: async (action) => {
      // Cleared BEFORE the attempt rather than after it: a verb that takes a
      // moment would otherwise run under the last one's sentence, which reads
      // as this one's answer.
      saying.say(null)
      try {
        saying.say(await action.run())
      } catch (cause) {
        saying.say({ tone: "alarm", text: `couldn't ${action.label.toLowerCase()}` })
        console.warn(`olai: "${action.label}" did not happen`, cause)
      }
    },
  }
}
