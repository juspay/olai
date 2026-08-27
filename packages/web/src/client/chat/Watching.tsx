/**
 * WHAT THIS CONVERSATION STILL HAS OUT — the strip under the header, beside the
 * one that names its tool servers.
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
 * TWO KINDS ON ONE STRIP, which is the change a fan-out brought. A background
 * task the agent armed, and an AGENT it sent out — because they are one
 * sentence to a reader (*something is still going on, and it has been going on
 * for this long*) and because the second one needed exactly the argument above,
 * one step further. A subagent's own calls are not drawn in the transcript any
 * more ({@link ./lanes.ts}'s `filedUnder`), so this is not merely the
 * convenient place to read who is out: **it is the DOOR.** Press an agent and
 * its work opens in the shelf under this one ({@link ./Preview.tsx}).
 *
 * WHICH IS WHY ONLY ONE OF THE TWO IS PRESSABLE. A background task has nothing
 * behind that door and never will — see below — so it is drawn as what it is,
 * and a control that opened an empty box is a control a reader stops trusting.
 *
 * WHAT IT DRAWS, per entry, and each is a fact off the wire:
 *
 *   - **what it is** — the description the task was armed with, which is what a
 *     person recognises their own watch by, and the call's own title when it
 *     was armed with none (the server decides which, since the fallback is a
 *     field of a row this strip does not have). For an agent that title is
 *     always what it was sent to do;
 *   - **how long it has been out** — the same words the row's own readout uses
 *     ({@link ./elapsed.ts}'s `outFor`, over the same stamp), ticking on the
 *     same clock.
 *
 * WHAT IT DOES NOT DRAW, and cannot: **when a task last did something.** A
 * monitor's events are on no wire olai can reach — they go to the model and to
 * the task's own output file, and no message underneath the adapter carries one
 * (`acp/patches/README.md` records the measurement). A "last event 20s ago"
 * that was really "armed 20s ago" would be the panel inventing the one fact a
 * person would trust it for. So the strip says what it knows: this is out, and
 * this is how long it has been. An AGENT is the case where that limit does not
 * bite, and that is the whole of what the door is: every call it has made IS on
 * the wire, and now there is somewhere to read them.
 *
 * IT IS EMPTY MOST OF THE TIME and absent with it. Nearly every conversation
 * arms nothing and spawns nobody, and a strip that drew "nothing running" would
 * be furniture on every panel in the app to serve the rare one.
 *
 * ITS CLOCK IS ITS OWN, and that is not a second answer to what time it is: the
 * panel's readout clock belongs to the rows that draw one
 * ({@link ./elapsing.tsx}) and this strip is outside them, so it reaches for
 * the same shared primitive (`../clock.ts`) the way the commit pill does. It
 * ticks only while something is out — the `<Show>` is what mounts it — so a
 * conversation with nothing running costs a tab nothing.
 */

import { For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { createNow, outFor } from "./elapsed.ts"
import { LIVE_DOT } from "./live.ts"
import { isPreviewing, togglePreview } from "./previewing.ts"
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
      // NOT "background tasks" any more, which is what it said and is now
      // half the truth: agents are on this strip too, and telling a screen
      // reader that five subagents are background tasks is naming one kind of
      // thing after the other. What both are is STILL RUNNING.
      aria-label="still running"
    >
      <p class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <For each={out()}>
          {(task) => {
            /** The words themselves, as a COMPONENT rather than a value, and
             *  that is not a style: a JSX expression built once is DOM built
             *  once, and the two arms below would be handed the same nodes to
             *  move between them. A component is instantiated by whichever arm
             *  is drawn. */
            const Said = () => (
              <>
                {/* The panel's one cue for "this is happening", the same one
                    the header and a spawn's rail wear. */}
                <span class={LIVE_DOT} aria-hidden="true" />
                <span class="min-w-0 truncate">{task.name}</span>
                <Show when={outFor(task.since, now())}>
                  {(said) => (
                    <span class="shrink-0 text-doing">
                      {/* The DURATION alone under the name, with the spoken
                          words outside it — the rule the row’s own readout
                          follows, so what a scenario reads back is the number
                          this rule decided rather than the sentence built
                          around it. */}
                      <span class="sr-only">running for&#32;</span>
                      <span data-testid={TESTID.chatWatchingFor}>{said()}</span>
                    </span>
                  )}
                </Show>
              </>
            )
            /**
             * AN AGENT IS A DOOR AND A TASK IS NOT, which is the whole reason
             * the kind is on the wire ({@link @olai/surface}'s `Watched`).
             *
             * A subagent's calls are not in the transcript any more, so this
             * strip is where a person watching a fan-out goes to read one —
             * press the agent, and its work opens in the shelf below. A
             * background task has nothing behind that door and never will: its
             * events reach the model and the task's own output file, and no
             * message underneath the adapter carries one (`acp/patches/
             * README.md` records the measurement). A control that opened an
             * empty box would be worse than no control, so the two are drawn
             * as what they are — one pressable, one not.
             */
            return (
              <Show
                when={task.kind === "agent"}
                fallback={
                  <span
                    class="flex min-w-0 items-baseline gap-1 text-ink"
                    data-testid={TESTID.chatWatchingTask}
                    data-kind={task.kind}
                    // The ROW it belongs to, which is the same key the
                    // transcript draws that row under: the strip and the
                    // record are one thing named twice, and a scenario should
                    // be able to say so.
                    data-row={task.row}
                  >
                    <Said />
                  </span>
                }
              >
                <button
                  type="button"
                  class="flex min-w-0 items-baseline gap-1 rounded-sm text-ink hover:text-accent aria-pressed:text-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  data-testid={TESTID.chatWatchingTask}
                  data-kind={task.kind}
                  data-row={task.row}
                  // WHICH ONE IS OPEN, said on the control rather than only in
                  // the shelf below: five agents out is five doors, one shelf,
                  // and a reader alternating between two of them has nothing
                  // else up here to tell them which they are reading.
                  aria-pressed={isPreviewing(task.row)}
                  onClick={() => togglePreview(task.row)}
                >
                  <Said />
                </button>
              </Show>
            )
          }}
        </For>
      </p>
    </section>
  )
}
