/** An opening refusal belongs to the requested conversation. Show the
 * engine's reason and retry that same attempt; no composer is available until
 * the session opens. Missing engine capability is drawn by NoAgent instead. */

import type { Unopened as Refused } from "olai-plugin-chat/wire"
import { Show } from "solid-js"

import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { TESTID } from "../../testids.ts"
import { Refusal } from "./Refusal.tsx"
import type { Chat } from "./state.ts"

export function Unopened(
  props: { readonly chat: Chat; readonly unopened: Refused },
) {
  return (
    <div
      class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 text-sm text-muted"
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

      {/* Its own line and its own id, for `Missing.tsx`'s reason: the REASON is
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
