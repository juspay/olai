/**
 * What the panel says when the agent is RUNNING and would not open a
 * conversation.
 *
 * The third of the panel's bodies ({@link ./face.ts}), and the one that is
 * about a live agent. {@link ./NoAgent.tsx} is a capability that is switched
 * off — nothing was attempted, so nothing was refused. This one had an answer:
 * something was asked for, the agent said no, and it is still there to be asked
 * again.
 *
 * Three arguments about how it is drawn, and each is a thing it deliberately is
 * not:
 *
 *   - **it is not the header's business.** The header goes on naming the model
 *     and saying *ready*, because that is true: the process is up and it just
 *     spoke. Reporting the refusal up there — which is what saying *not
 *     running* amounted to — makes a reader go looking for a dead agent that is
 *     not dead.
 *   - **it is not a banner over an empty transcript.** There is no transcript:
 *     no conversation was opened, so there is nothing to scroll and nothing to
 *     type into. A line of `trouble` above an empty pane with a live composer
 *     under it invites somebody to send a message that has nowhere to go. The
 *     body IS the explanation.
 *   - **it is not a dead end.** The one thing that can change the state is
 *     asking again, so the button is here rather than somewhere a reader has to
 *     find — and it asks for the SAME thing that was refused, which is the
 *     server's to remember and not this component's to reconstruct
 *     (`../../../../chat/src/chat.ts`'s `reopen`).
 *
 * The agent's own words are the feature. "The conversation could not be opened"
 * is the sentence every one of these failures shares and the one that never
 * helped anybody; what a reader can act on is that this agent does not keep
 * conversations, or that the session id it was asked for is one it has never
 * heard of.
 */

import type { Unopened as Refused } from "@olai/surface"
import { Show } from "solid-js"

import { QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"
import { Refusal } from "./Refusal.tsx"
import type { Chat } from "./state.ts"

export function Unopened(
  props: { readonly chat: Chat; readonly unopened: Refused },
) {
  return (
    <div
      class="olai-scroll flex-1 overflow-y-auto px-4 py-6 text-sm text-muted"
      data-testid={TESTID.chatUnopened}
    >
      <p class="m-0 mb-3 text-ink">
        {/* NAMED where a name was asked for, and not otherwise. A boot picks
            its own conversation, so "could not open `fake-stored-old`" would
            be this panel putting a name to a choice nobody made. */}
        {props.unopened.what === null
          ? "The agent would not open a conversation."
          : "The agent would not open that conversation."}
      </p>

      {/* Its own line and its own id, for `Roster.tsx`'s reason: the REASON is
          what this face exists for, and `break-words` because it can carry a
          session id or a method name into a 26rem drawer. */}
      <p
        class="m-0 mb-3 break-words font-mono text-xs text-alarm"
        data-testid={TESTID.chatUnopenedWhy}
      >
        {props.unopened.why}
      </p>

      <p class="m-0 mb-3">
        The agent itself is running — it answered. The outlines are served
        exactly as they would be otherwise; what is missing is the conversation.
      </p>

      {/* The header's own quiet pill, at the header's own scale — this sits in
          prose rather than in the transcript's 11px mono line, so it is the
          shared spelling rather than `Entry.tsx`'s smaller lookalike. */}
      <button
        type="button"
        class={QUIET_PILL}
        data-testid={TESTID.chatReopen}
        onClick={() => props.chat.reopen()}
      >
        try again
      </button>

      {/* WHAT THAT BUTTON WAS TOLD, when it was told something. The panel's
          refusal line lives in the transcript, and there is no transcript here
          — so without this a click on the one control in this body could be
          refused and say nothing at all, which is the one thing HACKING.md
          asks of every error. It is the same component the conversation draws,
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
