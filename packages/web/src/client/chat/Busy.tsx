/**
 * THE PANEL IS DOING SOMETHING — said where a person is looking, which is the
 * bottom of the transcript.
 *
 * The header has said this for a while ({@link ./Header.tsx}'s `working…`) and
 * it was not enough. That line lives in a two-line block of small mono chrome
 * beside a model name and a context readout, at the TOP of a panel whose
 * reader is at the BOTTOM — they have just pressed enter, so their eye is on
 * the box and the message above it. A turn that then produces nothing for
 * twenty seconds looks exactly like a turn that produced nothing at all, and
 * the one report that started this file was precisely that: *the row appears,
 * then nothing* (`docs/roadmap/bugs.olai`, `opencode-send-silent`).
 *
 * The composer's own border turns while a turn runs, and that is FOCUS styling
 * — it is the same border a click into the box draws — so it says "you are
 * typing here" to everybody who has ever used a text field, and cannot be
 * taught to say anything else.
 *
 * So: a strip between the last row and the box, in the flow rather than over
 * it, present exactly while the panel is busy and gone the instant it is not.
 *
 * ## Both kinds of busy, in one strip
 *
 * `booting` and `thinking` are one fact to a reader — *something is happening,
 * wait* — and two facts to the panel, and both used to be invisible down here.
 * A boot is the longer of the two now that choosing an agent starts a
 * subprocess, and it is the window a message sent into it goes quiet in
 * (`send-during-boot-doubles`), so it is the half most worth drawing.
 *
 * WHAT IT SAYS is read off the same state the header reads, so the two can
 * never disagree: a turn stopped on a question is not the agent's move, and
 * saying "working" over a form somebody has to fill in is the panel telling
 * them to wait for themselves. That case has its own words here as it does up
 * there.
 *
 * WHO is named where the panel knows — a machine with two agents installed is
 * one where "the agent" is a question — and left out where it does not, which
 * is the beat before the first agent is bound.
 */

import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { busyWith } from "./busy.ts"
import { LIVE_DOT } from "./live.ts"
import type { Chat } from "./state.ts"

/** The strip. Drawn between the transcript and the box (`./Panel.tsx`). */
export function Busy(props: { readonly chat: Chat }) {
  const doing = () => busyWith(props.chat.state())
  return (
    <Show when={doing()}>
      {(what) => (
        <div
          class="flex shrink-0 items-center gap-2 border-t border-rule/70 px-3 py-1.5 text-xs text-doing"
          data-testid={TESTID.chatBusy}
          aria-live="polite"
        >
          <span class={LIVE_DOT} aria-hidden="true" />
          <span class="truncate">{what()}</span>
        </div>
      )}
    </Show>
  )
}
