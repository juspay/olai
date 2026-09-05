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
 * Both layouts render the same `Face` — the header, which servers this
 * conversation has, and then one of the bodies ({@link ./face.ts}): the
 * conversation, the explanation that this machine has no agent, the explanation
 * that a live agent would not open one, the question of WHICH agent a
 * conversation is with ({@link ./Choose.tsx}), or the chats no node claims
 * ({@link ../agents/Unassigned.tsx}) — the last two being the two bodies that
 * are not a conversation at all, and the two this TAB decides rather than the
 * server. So the two shells own their chrome and their
 * geometry and nothing else. Inside it, `Body` is the conversation,
 * the box and the drop target around them: a file let go of anywhere on the
 * conversation is attached to it, and the chips land in the composer inside.
 * The body only — the header is session controls, and a file cannot go there.
 *
 * Between those two sit the three STRIPS. {@link Roster} names the MCP servers
 * this conversation has and says which of them the agent reported attaching;
 * {@link Watching} names the background tasks it still has out; {@link Wake}
 * says what it LISTENS for — which plugin may ring this conversation, and about
 * which file. All three are OUTSIDE the no-agent fallback and outside the drop
 * target on purpose: they are facts about the session rather than parts of the
 * conversation, and they belong where the header's other facts are — above the
 * scroll, and never carried away by it. The roster draws on every conversation
 * and none at all where there is no conversation (which is where #140's strip
 * drew only on a broken one); the tasks strip draws only while something is
 * running, because nearly every conversation runs nothing and a line saying so
 * would be furniture on every panel in the app; and the wake strip draws
 * wherever a running plugin has a doorbell to be pointed at something, since a
 * control that appeared only once it had been used would be a control nobody
 * finds.
 */

import { createEffect, createMemo, createSignal, Match, on, Show, Switch } from "solid-js"

import type { AgentChoice } from "olai-plugin-chat/wire"
import { hideUnassigned, showingUnassigned } from "../agents/showing.ts"
import { Unassigned } from "../agents/Unassigned.tsx"
import { PanelHandle } from "@olai/web/client/layout/Handle.tsx"
import { desktop } from "@olai/web/client/layout/media.ts"
import {
  panelOpen,
  panelSnap,
  panelWidth,
  setPanelOpen,
  setPanelSnap,
  type ChatSnap,
} from "@olai/web/client/layout/prefs.ts"
import { LAYER, WITHIN } from "@olai/web/client/layer.ts"
import { TESTID } from "../../testids.ts"
import { ICON_BUTTON } from "@olai/web/client/readout.ts"
import { createAsked } from "./attention/asked.ts"
import { createAttention } from "./attention/attention.ts"
import { Choose } from "./Choose.tsx"
import { Composer } from "./Composer.tsx"
import { DropTarget } from "./DropTarget.tsx"
import { ElapsedProvider } from "./elapsing.tsx"
import { Plan } from "./Plan.tsx"
import { Header } from "./Header.tsx"
import { faceOf } from "./face.ts"
import { createHolding } from "./holding.ts"
import { createLastAgent } from "./last.ts"
import { Minimized } from "./Minimized.tsx"
import { Preview } from "./Preview.tsx"
import { previewing } from "./previewing.ts"
import { Roster } from "./Roster.tsx"
import { Wake } from "./Wake.tsx"
import { Watching } from "./Watching.tsx"
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
      <Show when={panelOpen()}>
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
  const open = () => panelOpen()

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
      onClick={() => setPanelOpen(!open())}
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
  // WHICH of the five, decided in one place and asserted without a browser
  // ({@link ./face.ts}) — the precedence has been re-decided twice already, and
  // what it decides is which of five things a person is looking at. THIS TAB'S
  // OWN TWO go in as arguments rather than being tested beside the answer in
  // the JSX below, which is where half of this precedence used to live.
  const face = () =>
    faceOf(props.chat.state(), { unassigned: showingUnassigned(), asking: asking() })
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
   *  (`../../../../plugins/chat/src/chat.ts`). */
  const pick = (id: string): void => {
    // WHICH question was answered is read off the FACE rather than off this
    // tab's own signal, because the two are not symmetrical: the panel's own
    // question is the server's and outranks anything a click here started
    // ({@link ./face.ts} owns that precedence, and says which asked on the arm
    // itself). Read the other way round, a `+ new` pressed over a panel that
    // was ALREADY asking would answer the boot's question with the wrong verb
    // — minting a fresh conversation where the panel was about to come back to
    // the one this directory was in.
    const chosen = face()
    const server = chosen.kind === "choose" && chosen.asked === "server"
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
    // THE LIST GOES FIRST, because `+ new` OPENS A CONVERSATION and every other
    // door that does says so on its way through (`../agents/showing.ts`, and
    // `../agents/focus.ts` / `./NodeSessions.tsx` keeping it). Without this the
    // press landed nowhere a person could see: the unassigned list outranks
    // every face below it (`./face.ts`), so with one engine the fresh
    // conversation opened UNDER the list, and with several the question of
    // which agent could not draw until somebody pressed *done* — springing up
    // minutes after the press that raised it.
    //
    // BEFORE THE QUESTION IS READ, not after: the face is a function of this
    // signal, so a list still showing would answer `unassigned` here and hide
    // the one arm this button must not step on — the SERVER's own question,
    // which is answered with a different verb.
    hideUnassigned()
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
  /** ... and WHO is being asked which agent, where that is the body —
   *  `undefined` otherwise, which is what `<Match>` takes. Same shape and same
   *  reason as {@link refused}: the arm's payload comes off the answer that
   *  chose it. */
  const choosing = () => {
    const chosen = face()
    return chosen.kind === "choose" ? chosen.asked : undefined
  }
  /**
   * ...and WHY there is no agent, where that is the body.
   *
   * READ BESIDE THE ARM rather than matched on, which is the one place the
   * shape above does not fit: `null` is a legitimate value INSIDE this face —
   * a page whose first frame has not landed holds `CHAT_OFF`, whose reason is
   * "not told yet" — and a `<Match>` on the payload would drop the whole face
   * for it, leaving the panel blank exactly during the paint the face exists
   * for.
   */
  const noAgentBecause = () => {
    const chosen = face()
    return chosen.kind === "no-agent" ? chosen.off : null
  }
  /** The roster, for whichever door is asking. */
  const agents = (): ReadonlyArray<AgentChoice> => props.chat.state().roster
  return (
    <>
      <Header chat={props.chat} onNew={onNew} />
      <Plan chat={props.chat} />
      <Roster chat={props.chat} />
      {/* ... and what is still RUNNING in it, on the same shelf and for the
          same reason ({@link ./Watching.tsx}): a background task's own row is
          at its birth position, and by the time somebody asks whether their
          watch is still up, that position is an hour of scrollback away. Below
          the roster rather than above it — the servers are what this
          conversation HAS, which is true for its whole life, and this is what
          it is DOING, which is true for minutes at a time. */}
      <Watching chat={props.chat} />
      {/* ... and what it LISTENS for ({@link ./Wake.tsx}), last of the three
          for the same argument that ordered the first two: the servers are
          true for the conversation's whole life, what is running is true for
          minutes at a time, and what it wakes on is true until somebody
          changes it — the longest life goes furthest from the header, so the
          strips above it move under a reader as rarely as possible. A fourth
          sibling here rather than a line inside the strip above, because that
          one unmounts whenever nothing is running: a control put there would
          be missing on nearly every conversation, which is exactly when
          somebody goes looking for it. */}
      <Wake chat={props.chat} />
      <Switch fallback={<Body chat={props.chat} />}>
        <Match when={face().kind === "no-agent"}>
          <NoAgent off={noAgentBecause()} />
        </Match>
        {/* THE CHATS NOBODY CLAIMS, where somebody pressed the roster's last
            row ({@link ../agents/Unassigned.tsx}) — where it sits in the
            precedence, and why, is {@link ./face.ts}'s. */}
        <Match when={face().kind === "unassigned"}>
          <Unassigned chat={props.chat} />
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
            somebody's cursor. WHICH of them asked rides on the face rather than
            being asked again here, which was the same question answered twice
            in one component. */}
        <Match when={choosing()}>
          {(asked) => (
            <Choose
              agents={agents()}
              onPick={pick}
              onCancel={asked() === "tab" ? () => setAsking(false) : undefined}
            />
          )}
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
  /**
   * Whether anything is running in this conversation at all — WHEN THE PANEL'S
   * ONE CLOCK TICKS ({@link ./elapsing.tsx}), and nothing else.
   *
   * TWO WAYS TO BE RUNNING. A turn in flight is the obvious one. The other is
   * something the agent LEFT RUNNING and nobody has reported the end of — a
   * background task, or an agent it sent out: a monitor spends its entire life
   * in a conversation whose status is `idle`, which is exactly the state that
   * used to stop the clock, so the longest-running thing in the panel was the
   * one row whose readout never moved. What is out is the server's
   * (`ChatState.watching`, read off the rows it already holds), and the same
   * list the strip above the scroll draws ({@link ./Watching.tsx}).
   *
   * ONE memo for the whole panel rather than one per row, and a BOOLEAN rather
   * than the state: every row's readout would otherwise subscribe to the chat
   * cell, which moves several times a turn as the context usage is revised, and
   * re-run for each of them. A boolean propagates only when it flips.
   *
   * HERE RATHER THAN IN THE TRANSCRIPT, which is where it was, because there
   * are two places tool rows are drawn now: the conversation, and the shelf
   * that previews one subagent's calls. Every tool row asks for the elapsed
   * reading in its own body and that lookup THROWS outside the provider — so a
   * shelf mounted beside the transcript rather than inside it needed the
   * provider above them both. Which is what `./elapsing.tsx` always said it
   * was: ONE clock for the panel. A second provider inside the shelf would be a
   * second timer and a second subscription to the cell.
   */
  const live = createMemo(() => {
    const state = props.chat.state()
    return state.status === "thinking" || state.watching.length > 0
  })
  return (
    <DropTarget onFiles={(files) => void holding.take(files)}>
      <ElapsedProvider live={live()}>
        {/* ABOVE THE CONVERSATION AND INSIDE THE SAME COLUMN — a shelf rather
            than an overlay, so the transcript keeps its own scroll, its
            follow-the-bottom and the reveal that puts a blocked form in front
            of somebody ({@link ./Preview.tsx} argues the placement). It is
            absent whenever nothing is open, which is nearly always. */}
        <Preview chat={props.chat} />
        <Transcript chat={props.chat} />
      </ElapsedProvider>
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
      style={{ width: `${panelWidth()}px` }}
      data-testid={TESTID.chatPanel}
      data-status={chat.state().status}
      data-session-id={chat.state().session?.id}
      data-layout="dock"
      aria-label="agent"
    >
      <div class={`absolute inset-y-0 left-0 ${WITHIN.raised}`}>
        <PanelHandle />
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
    return panelSnap() === "full" ? 92 : 50
  }

  /**
   * OPENING A SUBAGENT'S WORK GOES FULL, and this is the one place in the panel
   * that has to know it.
   *
   * At the half snap this sheet is half a phone, and what is above the
   * conversation in it — the header, the roster, the strip (three lines once
   * five agents are out) — plus the composer under it already leave the
   * transcript a hundred-odd pixels. A shelf on top of that squeezes the
   * conversation toward its floor, and the conversation is where a question a
   * subagent asked is drawn. So the sheet grows rather than the reader losing
   * the thing they must not miss. The desktop dock is full height already and
   * has no such gesture, which is why this lives here and not in
   * {@link ./previewing.ts}: what the panel does about its own geometry is the
   * panel's, and a rule module that reached for a layout preference would move
   * the phone's snap from a click made on a desk.
   */
  createEffect(on(previewing, (open) => {
    if (open !== null) setPanelSnap("full")
  }, { defer: true }))

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
      if (dragged) setPanelSnap(pct >= 70 ? "full" : "half")
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
        onClick={() => setPanelOpen(false)}
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
        data-session-id={chat.state().session?.id}
        data-layout="sheet"
        data-snap={panelSnap()}
        aria-label="agent"
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={
            panelSnap() === "half"
              ? "drag to expand chat, or tap to toggle"
              : "drag to shrink chat, or tap to toggle"
          }
          class="flex shrink-0 cursor-grab touch-none flex-col items-center gap-1 py-2 active:cursor-grabbing"
          data-testid={TESTID.chatSheetHandle}
          onPointerDown={onHandlePointerDown}
          onClick={() => {
            // Tap without a meaningful drag still cycles.
            if (dragged) return
            setPanelSnap(panelSnap() === "half" ? "full" : "half")
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
