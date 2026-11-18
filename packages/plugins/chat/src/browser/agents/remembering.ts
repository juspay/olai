/**
 * WHAT A CHAT PAGE IS READING, REMEMBERED — the one thing the roster cannot
 * answer once a note has stopped naming its conversation (`./lost.ts`).
 *
 * A note's chat lives in the note, so a `git pull` or an agent's own file tools
 * can take the tie off a note whose page is open. The roster then says only
 * that this item has no chat: what it was reading a moment ago is gone with the
 * row. This memory is that moment, and it is what the *Tie it to <name> again*
 * press hands back (`./Lost.tsx`) — so it is kept where that press is drawn and
 * nowhere else. A page opened fresh on an untied note knows of no conversation
 * and offers none.
 *
 * REMEMBERED FROM THE FRAME THE PAGE OPENS ON, which is the whole of the rule
 * below and the thing a pair of plain effects got wrong. A page is drawn with a
 * chat list the tab usually already has, and a QUIET chat — one nobody is
 * talking in — moves nothing in that list afterwards. A page that only started
 * remembering on the NEXT frame to arrive was holding nothing for as long as
 * the list stayed still, so a tie dropped from outside in that window left the
 * page offering a box to start a SECOND chat, with the way back to the first
 * gone. What the page had seen was never the question: the roster it is drawn
 * from is the answer, from the first frame.
 *
 * ...AND A CLOSE THIS READER MADE FORGETS IT (`./closing.ts`). The tie is gone
 * either way, and the page cannot tell the two apart from the roster alone —
 * but one of them is this person's own press, which said in its own words that
 * olai would list the conversation nowhere afterwards. Holding what it was
 * would answer that press with *Tie it to plan again*, blaming the note's front
 * matter for something nobody outside did.
 *
 * SO IT IS A COUNT THIS PAGE WATCHES MOVE, not a count it reads once. The
 * closes are per item and never removed (`./closing.ts` argues the counter), so
 * a page compares what the count is NOW with what it was when this page last
 * looked: a close that happened before this page opened belongs to a chat that
 * has since been started again, and forgetting for it would be answering an old
 * press with a live conversation's memory.
 */
import { type Accessor, createEffect, createSignal } from "solid-js"

import { closedHere } from "./closing.ts"
import type { WasTied } from "./lost.ts"

/** What one run of the rule leaves for the next: which item was asked about,
 *  how many closes this reader had made on it by then, and what the page was
 *  holding. */
interface Seen {
  readonly key: string
  readonly closes: number
  readonly was: WasTied | null
}

export const createRemembered = (input: {
  /** The item key of the page drawing this. */
  readonly key: Accessor<string>
  /** The conversation the roster says this item has, while it has one. */
  readonly tied: Accessor<WasTied | null>
}): Accessor<WasTied | null> => {
  const [was, setWas] = createSignal<WasTied | null>(null)
  createEffect<Seen>((seen) => {
    const key = input.key()
    const closes = closedHere(key)
    const held = input.tied()
    // A PAGE THAT HAS BECOME ANOTHER ITEM'S starts again: the closes on the
    // item it is about now are somebody's older presses, and what the previous
    // item was reading is not this page's to offer back.
    const first = seen === undefined || seen.key !== key
    const next = first ? held : closes > seen.closes ? null : held ?? seen.was
    setWas(next)
    return { key, closes, was: next }
  })
  return was
}
