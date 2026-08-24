/**
 * WHAT IS STILL RUNNING IN THE BACKGROUND — the strip under the header, beside
 * the one that names this conversation's tool servers.
 *
 * The ruling this exists for (the human, 2026-08-24, after probing the design):
 * a background task's row is at its BIRTH POSITION. A monitor armed at the top
 * of a three-hour session is three hours of scrollback away by the time
 * somebody wonders whether their watch is still up — and they wonder at the
 * bottom, where they are. A live fact that can only be read by scrolling to
 * find it is a live fact nobody reads.
 *
 * So it is drawn where the header's other standing facts are, and
 * {@link ./Roster.tsx}'s three arguments hold here word for word: above the
 * scroll and never carried away by it; the panel's quiet vocabulary rather than
 * an alarm, because nothing is wrong — something is running; and not in the
 * transcript, because this is a property of the conversation as it stands
 * rather than something that happened at a point in it.
 *
 * WHAT IT DRAWS, per task, and each is a fact off the wire:
 *
 *   - **what it is watching** — the description the task was armed with, which
 *     is what a person recognises their own watch by, and the call's own title
 *     when it was armed with none (the server decides which, since the fallback
 *     is a field of a row this strip does not have);
 *   - **how long it has been out** — the same words the row's own readout uses
 *     ({@link ./elapsed.ts}'s `outFor`, over the same stamp), ticking on the
 *     same clock.
 *
 * WHAT IT DOES NOT DRAW, and cannot: **when the task last did something.** A
 * monitor's events are on no wire olai can reach — they go to the model and to
 * the task's own output file, and no message underneath the adapter carries one
 * (`acp/patches/README.md` records the measurement). A "last event 20s ago"
 * that was really "armed 20s ago" would be the panel inventing the one fact a
 * person would trust it for. So the strip says what it knows: this is out, and
 * this is how long it has been.
 *
 * IT IS EMPTY MOST OF THE TIME and absent with it. Nearly every conversation
 * arms nothing, and a strip that drew "no background tasks" would be furniture
 * on every panel in the app to serve the rare one.
 *
 * ITS CLOCK IS ITS OWN, and that is not a second answer to what time it is: the
 * panel's readout clock belongs to the transcript's rows
 * ({@link ./elapsing.tsx}) and this strip is outside them, so it reaches for
 * the same shared primitive (`../clock.ts`) the way the commit pill does. It
 * ticks only while something is out — the `<Show>` is what mounts it — so a
 * conversation with nothing running costs a tab nothing.
 */

import { For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { createNow, outFor } from "./elapsed.ts"
import { LIVE_DOT } from "./live.ts"
import type { Chat } from "./state.ts"

export function Watching(props: { readonly chat: Chat }) {
  const out = () => props.chat.state().watching
  return (
    <Show when={out().length > 0}>
      <Strip chat={props.chat} />
    </Show>
  )
}

/**
 * The strip itself, mounted only while something is out — which is what makes
 * the clock's lifetime the strip's own. A component rather than a branch
 * because `createNow` starts a timer, and a timer started in a body that is
 * drawn on every conversation is a timer running on every conversation.
 */
function Strip(props: { readonly chat: Chat }) {
  const out = () => props.chat.state().watching
  const now = createNow(() => true)
  return (
    <section
      class="shrink-0 border-b border-rule/70 bg-panel px-3 py-1.5 font-mono text-[0.6875rem] leading-snug"
      data-testid={TESTID.chatWatching}
      aria-label="background tasks"
    >
      <p class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <For each={out()}>
          {(task) => (
            <span
              class="flex min-w-0 items-baseline gap-1 text-ink"
              data-testid={TESTID.chatWatchingTask}
              // The ROW it belongs to, which is the same key the transcript
              // draws that row under: the strip and the record are one task
              // named twice, and a scenario should be able to say so.
              data-row={task.row}
            >
              {/* The panel's one cue for "this is happening", the same one the
                  header and a spawn's rail wear. */}
              <span class={LIVE_DOT} aria-hidden="true" />
              <span class="min-w-0 truncate">{task.name}</span>
              <Show when={outFor(task.since, now())}>
                {(said) => (
                  <span class="shrink-0 text-doing">
                    {/* The DURATION alone under the name, with the spoken words
                        outside it — the rule the row’s own readout follows, so
                        what a scenario reads back is the number this rule
                        decided rather than the sentence built around it. */}
                    <span class="sr-only">running for&#32;</span>
                    <span data-testid={TESTID.chatWatchingFor}>{said()}</span>
                  </span>
                )}
              </Show>
            </span>
          )}
        </For>
      </p>
    </section>
  )
}
