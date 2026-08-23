/**
 * The chat panel: open dock (or mobile bottom sheet), or minimized signal.
 *
 * Every panel has exactly two states — open, or minimized-with-signal. Open on
 * desktop is a drag-resizable right dock under the header; open on a phone is
 * a bottom sheet with half/full snap points (drag the grab handle between
 * them). Minimized is the bottom-right pill (desktop) or the thumb strip
 * (phone).
 *
 * On desktop the header's agent toggle is the permanent chrome control (#101).
 * On a phone the toggle is gone from the bar: the thumb strip opens the sheet,
 * and the sheet's scrim puts it away. The TRANSCRIPT is subscribed only while
 * the panel is open; Minimized reads a module-scoped snapshot updated from
 * here (`last.ts`), never the collection — and so does the attention banner's
 * second line (`attention/asked.ts`), which is the same arrangement with one
 * difference: it is emptied when the panel shuts, because a stale question in
 * a system notification is a lie and a stale last message under a pill is not.
 *
 * WHAT IS OUTSIDE both shells is {@link Panel} itself, and the one thing it
 * does: telling a person the agent has stopped on them
 * (`attention/attention.ts`). It is out there because a question arriving
 * behind a MINIMIZED panel is the case that feature exists for.
 *
 * Both layouts render the same `Face` — the header, whatever this conversation
 * is short of, and then one of four bodies ({@link ./face.ts}): the
 * conversation, the explanation that this machine has no agent, the explanation
 * that a live agent would not open one, or the question of WHICH agent a
 * conversation is with ({@link ./Choose.tsx}). So the two shells own their chrome and their
 * geometry and nothing else. Inside it, `Body` is the conversation,
 * the box and the drop target around them: a file let go of anywhere on the
 * conversation is attached to it, and the chips land in the composer inside.
 * The body only — the header is session controls, and a file cannot go there.
 *
 * Between those two sits {@link Missing}, which draws nothing at all unless this
 * conversation was short of an MCP server it was meant to have. It is OUTSIDE
 * the no-agent fallback and outside the drop target on purpose: it is a fact
 * about the session rather than a part of the conversation, and it belongs
 * where the header's other facts are — above the scroll, and never carried
 * away by it.
 */

import { createSignal, Match, Show, Switch } from "solid-js"

import type { AgentChoice } from "@olai/surface"

import { ChatHandle } from "../layout/Handle.tsx"
import { desktop } from "../layout/media.ts"
import {
  chatOpen,
  chatSnap,
  chatWidth,
  setChatOpen,
  setChatSnap,
  type ChatSnap,
} from "../layout/prefs.ts"
import { LAYER, WITHIN } from "../layer.ts"
import { TESTID } from "../testids.ts"
import { ICON_BUTTON } from "../readout.ts"
import { createAsked } from "./attention/asked.ts"
import { createAttention } from "./attention/attention.ts"
import { Choose } from "./Choose.tsx"
import { Composer } from "./Composer.tsx"
import { DropTarget } from "./DropTarget.tsx"
import { Header } from "./Header.tsx"
import { faceOf } from "./face.ts"
import { createHolding } from "./holding.ts"
import { createLastAgent } from "./last.ts"
import { Minimized } from "./Minimized.tsx"
import { Missing } from "./Missing.tsx"
import { Busy } from "./Busy.tsx"
import { NoAgent } from "./NoAgent.tsx"
import { type Chat, createChat, createChatState } from "./state.ts"
import { Transcript } from "./Transcript.tsx"
import { Unopened } from "./Unopened.tsx"

export function Panel() {
  // WHETHER A PERSON IS TOLD the agent has stopped on them, and it is out here
  // — outside the `Show` — because that is the whole point of it: a question
  // arriving behind a minimized panel is the case it exists for, and a circuit
  // inside the open dock would go quiet exactly then. It costs the cheap chat
  // cell and no transcript (`./attention/attention.ts`).
  createAttention(createChatState())
  return (
    <>
      <Show when={chatOpen()}>
        <Show when={desktop()} fallback={<MobileSheet />}>
          <DesktopDock />
        </Show>
      </Show>
      <Minimized />
    </>
  )
}

/**
 * The agent control in the app header on desktop: always on screen, toggles
 * open/minimized.
 *
 * A phone does not draw this. The thumb strip is the door (`./Minimized.tsx`),
 * and the sheet's scrim is the way out — a second toggle in a bar that is
 * already only identity and search would be the chips this left the bar to
 * escape. The word is `sr-only` below 40rem on the desktop button, kept for
 * the same reason it always was: the mark is already an icon.
 */
export function Toggle() {
  const state = createChatState()
  const working = () => state().status === "thinking"
  /** A turn stopped on a question. Its own bit on the permanent chrome,
   *  because this is the one state a shut panel must not swallow: an agent
   *  thinking behind a closed drawer will finish by itself, and an agent
   *  waiting on somebody who cannot see it never will. */
  const asking = () => state().asking > 0
  const open = () => chatOpen()

  return (
    <button
      type="button"
      // The bar's icon-button shape (`../readout.ts`), which the preferences
      // trigger beside it wears too — 44px tall on a phone, wide enough for the
      // mark. The HEIGHT is what was missing: this button measured 76×27
      // before, wide and never tall enough. The WIDTH is not forced to a
      // square, because four of those plus `live` plus the commit mark do not
      // fit at 360pt (`../readout.ts`). The BORDER is this button's own news:
      // a turn running, or the panel open.
      class={`${ICON_BUTTON} border ${
        working()
          ? "animate-pulse border-doing text-doing"
          : open()
          ? "border-accent text-paper"
          : "border-paper/25"
      }`}
      data-testid={TESTID.chatToggle}
      data-busy={working()}
      data-asking={asking()}
      aria-pressed={open() ? "true" : "false"}
      title={
        asking()
          ? open()
            ? "the agent is waiting on your answer"
            : "the agent is waiting on your answer — open the panel"
          : working()
          ? open()
            ? "the agent is working — minimize the panel"
            : "the agent is working — open the panel"
          : open()
          ? "minimize the agent panel"
          : "open the agent panel"
      }
      onClick={() => setChatOpen(!open())}
    >
      &gt;_<span class="sr-only sm:not-sr-only"> agent</span>
    </button>
  )
}

/**
 * Everything inside either shell: the header, whatever this conversation is
 * short of, and then the conversation or one of the two explanations of why
 * there is none — no agent to ask, or an agent that answered and said no.
 *
 * The HEADER is drawn in all three, which is the point of it being out here: a
 * conversation that could not be opened is not a dead agent, and the line
 * naming the model goes on being true while the body says what happened.
 *
 * The two layouts differ in their chrome and their geometry and never in THIS,
 * and the argument is the one {@link Body} already makes one level down: three
 * elements in a fixed order, kept identical in two places 100 lines apart, is
 * one place for the next one to be added and another for it to be forgotten —
 * and the phone is the copy that gets forgotten, because the scenarios that
 * would notice mostly run on a desktop viewport.
 */
function Face(props: { readonly chat: Chat }) {
  // WHAT AN OPEN PANEL PUBLISHES for the things outside it: the last agent row
  // for the minimized face (`./last.ts`), and the waiting question for the
  // notification (`./attention/asked.ts`). Here rather than in the two shells,
  // for the reason everything else in this component is here — three things in
  // a fixed order kept identical in two places 100 lines apart is one place
  // for the next to be added and another for it to be forgotten. It matters
  // more for these than for the chrome: both die with this owner, and a shell
  // that forgot the second would leave a stale question in a system
  // notification, silently, which is the one thing that snapshot exists to
  // prevent.
  createLastAgent(props.chat)
  createAsked(props.chat)
  // WHICH of the four, decided in one place and asserted without a browser
  // ({@link ./face.ts}) — the precedence has been re-decided once already, and
  // what it decides is which of four things a person is looking at.
  const face = () => faceOf(props.chat.state())
  /**
   * A person pressed `+ new` and is being asked which agent — THIS TAB'S, and
   * deliberately not the server's.
   *
   * The panel's own `asking` is a state the SERVER is in: it has no
   * conversation and is waiting to be told which agent to open one with, and
   * every tab watching sees the same thing because it is true of the panel.
   * This is a person part-way through a gesture, like a half-typed message: it
   * belongs to the tab it was made in, it is cancellable, and a second tab has
   * no business being taken over by it.
   */
  const [asking, setAsking] = createSignal(false)
  /** ... and the answer, whichever door asked. `+ new` always means a FRESH
   *  conversation; the panel's own question means "open what you would have
   *  opened" — two verbs, because they mean two things
   *  (`../../../../chat/src/chat.ts`). */
  const pick = (id: string): void => {
    // WHICH question was answered is read off the FACE rather than off this
    // tab's own signal, because the two are not symmetrical: the panel's own
    // question is the server's and outranks anything a click here started.
    // Read the other way round, a `+ new` pressed over a panel that was
    // ALREADY asking would answer the boot's question with the wrong verb —
    // minting a fresh conversation where the panel was about to come back to
    // the one this directory was in.
    const server = face().kind === "choose"
    setAsking(false)
    if (server) {
      props.chat.chooseAgent(id)
      return
    }
    props.chat.newSession(id)
  }
  /**
   * What `+ new` does, which depends on whether there is a question to ask.
   *
   * ONE INSTALLED AGENT IS NOT A CHOICE — the ruling's own shape, read at the
   * one door a person can reach it from. Asking a one-row question is friction
   * with no answer behind it, and every olai before this one was in exactly
   * that state, so `+ new` there is what it has always been: a fresh
   * conversation, at once.
   */
  const onNew = (): void => {
    // A panel that is already asking has nothing for this button to add: the
    // question is up, and the answer to it opens a conversation.
    if (face().kind === "choose") return
    const roster = props.chat.state().roster
    const only = roster.length === 1 ? roster[0] : undefined
    if (only !== undefined) {
      props.chat.newSession(only.id)
      return
    }
    setAsking(true)
  }
  // The REASON comes off the same answer that chose the arm, rather than being
  // fetched again from the cell: two reads of one fact are two answers free to
  // disagree, and the one that can be `null` is exactly the one a second read
  // would have to assert away.
  const refused = () => {
    const chosen = face()
    return chosen.kind === "unopened" ? chosen.unopened : undefined
  }
  /** The roster, for whichever door is asking. */
  const agents = (): ReadonlyArray<AgentChoice> => props.chat.state().roster
  return (
    <>
      <Header chat={props.chat} onNew={onNew} />
      <Missing chat={props.chat} />
      <Switch fallback={<Body chat={props.chat} />}>
        <Match when={face().kind === "no-agent"}>
          <NoAgent />
        </Match>
        <Match when={refused()}>
          {(unopened) => <Unopened chat={props.chat} unopened={unopened()} />}
        </Match>
        {/* ONE ARM for both doors, and the prop is where they differ: the
            panel's own question has no way out — there is no conversation
            behind it to keep — and this tab's does, because the conversation
            underneath is still open and a misclick must not be a one-way door.
            Two arms would also be two component instances, so a tab-local
            question superseded by the server's would remount the list under
            somebody's cursor. */}
        <Match when={face().kind === "choose" || asking()}>
          <Choose
            agents={agents()}
            onPick={pick}
            onCancel={face().kind === "choose" ? undefined : () => setAsking(false)}
          />
        </Match>
      </Switch>
    </>
  )
}

/**
 * Everything under the header: the conversation, the box, and the drop target
 * around both.
 *
 * One component because the two layouts differ in their chrome and their
 * geometry and never in this — and because the drop target and the composer
 * have to share one `holding`, which is a wiring nobody should have to keep
 * identical in two places 100 lines apart.
 */
function Body(props: { readonly chat: Chat }) {
  const holding = createHolding(props.chat)
  return (
    <DropTarget onFiles={(files) => void holding.take(files)}>
      <Transcript chat={props.chat} />
      {/* BETWEEN the two, which is the whole point of it: the reader's eye is
          at the bottom of the transcript because that is where their own
          message just landed, and this is the line under it
          ({@link ./Busy.tsx}). */}
      <Busy chat={props.chat} />
      <Composer chat={props.chat} holding={holding} />
    </DropTarget>
  )
}

function DesktopDock() {
  const chat = createChat()

  return (
    <aside
      class={`fixed right-0 top-[var(--height-header)] ${LAYER.page} flex h-[calc(var(--visible-h,100dvh)-var(--height-header))] max-w-full min-w-0 flex-col border-l border-rule/70 bg-desk`}
      style={{ width: `${chatWidth()}px` }}
      data-testid={TESTID.chatPanel}
      data-status={chat.state().status}
      data-layout="dock"
      aria-label="agent"
    >
      <div class={`absolute inset-y-0 left-0 ${WITHIN.raised}`}>
        <ChatHandle />
      </div>
      <Face chat={chat} />
    </aside>
  )
}

/**
 * Mobile bottom sheet under the header: half / full snaps, drag the grab
 * handle between them (or tap to cycle). Scrim dismiss → minimized strip.
 * Host starts below the header so chrome stays tappable.
 */
function MobileSheet() {
  const chat = createChat()
  const [dragPct, setDragPct] = createSignal<number | null>(null)
  /** The box the sheet's percentage height is a percentage OF: it starts under
   *  the bar and ends at the bottom of the viewport. Measured rather than
   *  derived — a drag scaled by "viewport minus a hardcoded 64" was a third
   *  spelling of `--height-header` that had to be edited when the bar grew,
   *  and it disagreed with this box whenever the two viewports did. */
  let host!: HTMLDivElement
  /** True when the last pointer gesture moved enough to count as a drag
   *  rather than a tap-to-cycle. */
  let dragged = false

  const heightPct = () => {
    const drag = dragPct()
    if (drag !== null) return drag
    return chatSnap() === "full" ? 92 : 50
  }

  const onHandlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragged = false
    const startY = event.clientY
    const startPct = heightPct()
    const usable = Math.max(1, host.clientHeight)

    const onMove = (e: PointerEvent) => {
      const dy = startY - e.clientY
      if (Math.abs(dy) > 4) dragged = true
      // Drag up → taller sheet.
      const next = Math.min(95, Math.max(30, startPct + (dy / usable) * 100))
      setDragPct(next)
    }
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onEnd)
      window.removeEventListener("pointercancel", onEnd)
      const pct = dragPct() ?? startPct
      setDragPct(null)
      if (dragged) setChatSnap(pct >= 70 ? "full" : "half")
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onEnd)
    window.addEventListener("pointercancel", onEnd)
  }

  return (
    <div
      ref={host}
      class={`fixed inset-x-0 bottom-0 top-[var(--height-header)] ${LAYER.chrome} md:hidden`}
      data-testid={TESTID.chatSheet}
    >
      <button
        type="button"
        class="absolute inset-0 bg-ink/40"
        data-testid={TESTID.chatSheetScrim}
        aria-label="minimize the agent panel"
        onClick={() => setChatOpen(false)}
      />
      <aside
        class="absolute inset-x-0 bottom-0 flex min-w-0 flex-col rounded-t-xl border-t border-rule/70 bg-desk shadow-lg"
        style={{
          height: `${heightPct()}%`,
          "max-height": "100%",
          "padding-bottom": "env(safe-area-inset-bottom, 0px)",
        }}
        data-testid={TESTID.chatPanel}
        data-status={chat.state().status}
        data-layout="sheet"
        data-snap={chatSnap()}
        aria-label="agent"
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={
            chatSnap() === "half"
              ? "drag to expand chat, or tap to toggle"
              : "drag to shrink chat, or tap to toggle"
          }
          class="flex shrink-0 cursor-grab touch-none flex-col items-center gap-1 py-2 active:cursor-grabbing"
          data-testid={TESTID.chatSheetHandle}
          onPointerDown={onHandlePointerDown}
          onClick={() => {
            // Tap without a meaningful drag still cycles.
            if (dragged) return
            setChatSnap(chatSnap() === "half" ? "full" : "half")
          }}
        >
          <span class="h-1 w-10 rounded-full bg-rule" aria-hidden="true" />
        </div>
        <Face chat={chat} />
      </aside>
    </div>
  )
}

export type { ChatSnap }
