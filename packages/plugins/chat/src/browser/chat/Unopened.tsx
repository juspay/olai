/** An opening refusal belongs to the requested conversation. Show the
 * engine's reason and retry that same attempt; no composer is available until
 * the session opens. Missing engine capability is drawn by NoAgent instead.
 *
 * ONE REFUSAL IS NOT LIKE THE OTHERS, and this face is where that shows. A
 * refusal for want of a SEAT (`@olai/format`'s `BusyCause`) is not a fault and
 * not a thing to press again: every node agent is awake, the server is holding
 * this attempt, and it opens itself the moment somebody puts one to sleep
 * (`../../server/readings.ts`). So that case is drawn quietly, says what to
 * do, and offers no button — a *Try again* there would be a control whose only
 * honest answer is "still full", and an alarm colour would report a problem
 * with a chat that has nothing wrong with it. */

import type { Unopened as Refused } from "olai-plugin-chat/wire"
import { Show } from "solid-js"

import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { TESTID } from "../../testids.ts"
import { Refusal } from "./Refusal.tsx"
import type { Chat } from "./state.ts"

/**
 * WHICH OF THE TWO, and the box both are drawn in.
 *
 * The two bodies share a scroller, an id and the said line under them, and
 * nothing else — one is about a fault and offers the way out of it, the other
 * is about a wait and offers nothing. They are two components for that reason
 * rather than one with a flag threaded through its paragraphs.
 */
export function Unopened(
  props: { readonly chat: Chat; readonly unopened: Refused },
) {
  return (
    <div
      class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 text-body text-muted"
      data-testid={TESTID.chatUnopened}
      data-cause={props.unopened.cause?.kind}
    >
      <Show
        when={props.unopened.cause?.kind === "capacity"}
        fallback={<AgentSaidNo chat={props.chat} unopened={props.unopened} />}
      >
        <WaitingForASeat why={props.unopened.why} />
      </Show>

      {/* WHAT A PRESS WAS TOLD, when there was one to press. The panel's
          refusal line lives in the transcript, and there is no transcript here
          — so without this a click on the one control in this body could be
          refused and say nothing at all, which is the one thing the error
          rule asks of every error. It is the same component the conversation draws,
          because it is the same kind of answer.

          The press it reports is the SECOND one: `reopen` takes the attempt as
          it reads it, so a retry already in flight leaves nothing for the next
          click to leave with, and it is told so rather than opening a second
          conversation on top of the first. */}
      <Show when={props.chat.refused()}>
        {(failure) => (
          <div class="mt-3" data-testid={TESTID.chatRefused}>
            <Refusal failure={failure()} />
          </div>
        )}
      </Show>
    </div>
  )
}

/** THE AGENT ANSWERED, AND ITS ANSWER WAS NO — the ordinary case, and the one
 *  there is something to do about. */
function AgentSaidNo(props: { readonly chat: Chat; readonly unopened: Refused }) {
  return (
    <>
      <p class="m-0 mb-3 text-ink">
        {/* NAMED where a name was asked for, and not otherwise. A boot picks
            its own conversation, so "could not open `fake-stored-old`" would
            be this panel putting a name to a choice nobody made. */}
        {props.unopened.what === null
          ? "The agent couldn't open a chat."
          : "The agent couldn't open that chat."}
      </p>

      {/* Its own line and its own id, for `Missing.tsx`'s reason: the REASON is
          what this face exists for, and `break-words` because it can carry a
          session id or a method name into a 26rem drawer. */}
      <p class="m-0 mb-3 break-words text-label text-alarm" data-testid={TESTID.chatUnopenedWhy}>
        {props.unopened.why}
      </p>

      <p class="m-0 mb-3">
        Your notes still work. Try again once the problem is fixed.
      </p>

      {/* The header's own quiet pill, at the header's own scale — this sits in
          prose rather than in the transcript's 11px mono line, so it is the
          shared spelling rather than `Entry.tsx`'s smaller lookalike. */}
      <button type="button" class={QUIET_PILL} data-testid={TESTID.chatReopen}
        onClick={() => props.chat.reopen()}>
        Try again
      </button>
    </>
  )
}

/** EVERY SEAT IS TAKEN, which is not a fault and not a thing to press again.
 *  The sentence is the server's, verbatim — it names how many seats there are
 *  and the node menu's refusal says exactly the same words — and the line
 *  under it is what this panel is going to do about it on its own. */
function WaitingForASeat(props: { readonly why: string }) {
  return (
    <>
      <p class="m-0 mb-3 text-ink" data-testid={TESTID.chatUnopenedWhy}>{props.why}</p>
      <p class="m-0">This chat opens here as soon as a seat frees.</p>
    </>
  )
}
