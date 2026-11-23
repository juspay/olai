/**
 * What a conversation has STANDING — its plan, its tools, what it still has
 * out, and what may ring it — as one block, because where that block goes is
 * one decision.
 *
 * Each strip argues for itself that it is "above the scroll and never carried
 * away by it" ({@link ./Roster.tsx}, {@link ./Watching.tsx}). In a fold that is
 * true of wherever they are drawn: the transcript is the only thing that
 * scrolls. On a node page it was not — the pane is the scroll there, and
 * strips drawn above the transcript left with the memory above them, so a
 * reader at the newest line could not see that three agents were still out.
 * The page draws this in its pinned head instead (`../agents/Page.tsx`).
 *
 * ## Two faces, one set of strips
 *
 * {@link Strips} stacks them, which is what a fold and a node's page draw.
 * {@link StripChips} is the chat page's status bar above its composer
 * (`../agents/AgentLine.tsx`'s `foot`): one chip a strip, saying the strip in a
 * few words — *Plan 2/5*, *✓ 4 tools*, *2 running*, *Sleep · On* — and one
 * panel over the conversation that a chip opens with that strip in it, the same
 * component and the same controls as the stacked face. A whole head of strips
 * pinned over a long conversation took a third of the screen, which is the
 * complaint this face answers; a chip is one line for all four.
 *
 * THE STRIPS STAY MOUNTED while the panel is shut, `hidden` rather than
 * unmade. They were mounted all along in the head, so this costs nothing a
 * page did not already pay, and it keeps what each strip owns — its clock, its
 * open wake picker, the subagent it has open below — through a glance at
 * another chip.
 */

import { createEffect, createMemo, createSignal, createUniqueId, type JSX, Show } from "solid-js"
import { notHere } from "olai-plugin-chat/wire"
import { createInlinePicker } from "@olai/web/client/inlinePicker.ts"
import { LAYER } from "@olai/web/client/layer.ts"

import { TESTID } from "../../testids.ts"
import { faces } from "../faces.ts"
import { hangFrom } from "./hang.ts"
import { LIVE_DOT } from "./live.ts"
import { Plan } from "./Plan.tsx"
import { Roster } from "./Roster.tsx"
import { sleepWords } from "./sleeping.ts"
import { Standing, standingOf } from "./Standing.tsx"
import type { Chat } from "./state.ts"
import { Watching } from "./Watching.tsx"

export function Strips(props: { readonly chat: Chat }) {
  // ...AND STANDING LAST, because it is the one line the per-conversation marks
  // share: sleep first on it, the wake faces after ({@link ./Standing.tsx}
  // argues why the two are items of one bar rather than a strip each).
  return <><Plan chat={props.chat} /><Roster chat={props.chat} /><Watching chat={props.chat} /><Standing chat={props.chat} /></>
}

/** Which strip a chip stands for, and which the panel is showing. */
type Strip = "plan" | "tools" | "running" | "standing"

const CHIP = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-rule px-2 text-label text-muted hover:bg-ink/5 hover:text-ink aria-expanded:bg-ink/5 aria-expanded:text-ink"

/**
 * The chips and the one panel they open. ONE PICKER for the four, so a press
 * on a second chip shows its strip in the same panel instead of stacking a
 * second panel over the first; the trigger is whichever chip was pressed
 * last, which is where Escape puts the caret back.
 */
export function StripChips(props: { readonly chat: Chat }) {
  const state = () => props.chat.state()
  const standing = createMemo(() => standingOf(props.chat))
  const done = () => state().plan.filter((step) => step.status === "completed").length
  /** Servers this conversation does not have, by the wire's own total switch
   *  (`./Missing.tsx` lists the same ones under the roster). */
  const absent = () => state().servers.filter(notHere).length
  const connected = () => state().servers.every((server) => server.standing === "connected")
  /** What the wake faces are holding for this conversation, all of them. */
  const waiting = () => faces().hung("conversation.wake")
    .reduce((sum, row) => sum + (state().wake.find((one) => one.name === row.plugin)?.waiting ?? 0), 0)
  const present = (strip: Strip): boolean => {
    switch (strip) {
      case "plan": return state().plan.length > 0
      case "tools": return state().servers.length > 0
      case "running": return state().watching.length > 0
      case "standing": return standing().sleep !== undefined || standing().waking
    }
  }

  let pressed: Strip = "tools"
  const picker = createInlinePicker<Strip>({ opening: () => pressed })
  const [up, setUp] = createSignal(true)
  const press = (strip: Strip, chip: HTMLElement): void => {
    const other = picker.open() && picker.showing() !== strip
    if (!picker.open()) setUp(hangFrom(chip.offsetParent ?? chip).up)
    picker.setTrigger(chip)
    pressed = strip
    if (other) picker.show(strip)
    else picker.toggle()
  }
  // A strip that empties while it is shown (the last subagent came back)
  // takes its chip with it, and an open panel over nothing is a box to close.
  createEffect(() => {
    const showing = picker.showing()
    if (showing !== undefined && !present(showing)) picker.shut()
  })
  const panel = createUniqueId()

  const Chip = (chip: { readonly strip: Strip; readonly tone?: string; readonly children: JSX.Element }) => (
    <Show when={present(chip.strip)}>
      <button
        type="button"
        class={`${CHIP} ${chip.tone ?? ""}`}
        aria-expanded={picker.showing() === chip.strip}
        aria-controls={panel}
        data-testid={TESTID.chatBarChip}
        data-strip={chip.strip}
        onClick={(event) => press(chip.strip, event.currentTarget)}
      >{chip.children}</button>
    </Show>
  )
  const Shown = (one: { readonly strip: Strip; readonly children: JSX.Element }) => (
    <div data-testid={TESTID.chatBarStrip} data-strip={one.strip} hidden={picker.showing() !== one.strip}>{one.children}</div>
  )

  return <>
    <Chip strip="plan">Plan {done()}/{state().plan.length}</Chip>
    <Chip strip="tools">
      <Show when={absent() > 0} fallback={<Show when={connected()}><span class="text-done" aria-hidden="true">✓</span></Show>}>
        <span class="text-alarm" aria-hidden="true">×</span>
      </Show>
      {absent() > 0 ? `${absent()} of ${state().servers.length} tools` : state().servers.length === 1 ? "1 tool" : `${state().servers.length} tools`}
    </Chip>
    <Chip strip="running" tone="text-doing"><span class={LIVE_DOT} aria-hidden="true" />{state().watching.length} running</Chip>
    <Chip strip="standing">
      {/* A chat whose sleep is off in this directory's settings has no
          forecast, and reads Off whatever its own mark says. */}
      <Show when={standing().sleep} fallback="Alert">{(row) => <>Sleep · {sleepWords(row().sleep !== null && row().sleeps)}</>}</Show>
      <Show when={waiting() > 0}><span class="text-doing">· {waiting()} waiting</span></Show>
    </Chip>
    {/* HUNG FROM THE BAR'S BOX, as wide as the conversation, and opening to
        whichever side has the room (`./hang.ts`) — over the conversation,
        since the bar sits on the composer at the bottom of the screen.

        NOT A SCROLLER, and not cut to that room: a strip hangs lists of its
        own (a wake face's file picker, `absolute top-full` of its row), and a
        box that clipped its overflow would hide them inside it. The strips
        are a few lines each, and the plan scrolls its own steps. */}
    <div
      id={panel}
      ref={picker.setList}
      hidden={!picker.open()}
      data-testid={TESTID.chatBarPanel}
      class={`absolute inset-x-3 ${up() ? "bottom-full mb-1" : "top-full mt-1"} ${LAYER.page} rounded-surface border border-rule bg-panel text-ink shadow-raised`}
    >
      <Shown strip="plan"><Plan chat={props.chat} /></Shown>
      <Shown strip="tools"><Roster chat={props.chat} /></Shown>
      <Shown strip="running"><Watching chat={props.chat} /></Shown>
      <Shown strip="standing"><Standing chat={props.chat} /></Shown>
    </div>
  </>
}
