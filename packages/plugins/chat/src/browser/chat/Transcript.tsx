import { createWaitingForms, WaitingFormsProvider } from "./waiting-forms.ts"
/**
 * The jump to the bottom is not a reader scroll, but the event it schedules
 * cannot be ignored with a flag around the assignment: Chromium (149, and the
 * suite's Playwright) dispatches `scroll` asynchronously, at a rendering
 * update, so a boolean held across the write is already false when the handler
 * runs. What is remembered instead is the `scrollTop` that was assigned.
 */

import { agentIn } from "olai-plugin-chat/wire"
import { createEffect, createMemo, For, on, onCleanup, onMount, Show } from "solid-js"

import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { useShown, useMaybeRouter } from "olai-plugin-navigation/routing"
import { TESTID } from "../../testids.ts"
import { wholeYet } from "./attention/whole.ts"
import { declaringFailure } from "../references.ts"
import { laneOf } from "./lanes.ts"
import { NEAR } from "./near.ts"
import { useConversationUI } from "./ui.tsx"
import { railOf, sameRail } from "./rail.ts"
import { createPrevious } from "./previous.ts"
import { Refusal } from "./Refusal.tsx"
import { Row } from "./Row.tsx"
import { facedAt } from "./speakers.ts"
import type { Faced } from "./Speaker.tsx"
import { sentOf } from "./spawn.ts"
import type { Chat } from "./state.ts"

export function Transcript(props: { readonly chat: Chat; readonly page?: boolean }) {
  const [revealing, setRevealing] = props.chat.ui.reveal
  const revealed = () => setRevealing(false)
  const { previewing } = useConversationUI().previewing
  const shown = useShown()
  const router = useMaybeRouter()
  let grown: ResizeObserver | undefined
  let pane: HTMLDivElement | undefined
  let content: HTMLDivElement | undefined
  let outer: HTMLElement | undefined
  const scrollPane = () => props.page ? outer : pane
  let following = true
  let restoringVisibility = true
  let assignedTop = Number.NaN
  /** Where the rows begin in the host's content, and where its scroll was, as
   *  of the last scroll handled or made. The browser's scroll anchoring keeps
   *  the row under the reader's eye still while something ABOVE it grows or
   *  shrinks, by moving `scrollTop` by exactly that much — forward when the
   *  head grew, back when it shrank — so a scroll that equals the rows' own
   *  move is anchoring and any other is a hand. */
  let seenStart = Number.NaN
  let seenTop = Number.NaN
  const startOf = (host: HTMLElement): number => {
    if (pane === undefined || host === pane) return 0
    const top = pane.getBoundingClientRect().top
    return host === document.documentElement ? top + window.scrollY : top - host.getBoundingClientRect().top + host.scrollTop
  }
  const measure = (host: HTMLElement): { readonly above: number; readonly top: number } => {
    const start = startOf(host)
    const moved = { above: start - seenStart, top: host.scrollTop - seenTop }
    seenStart = start
    seenTop = host.scrollTop
    return moved
  }

  const atBottom = (): boolean => {
    const host = scrollPane()
    return host !== undefined && host.scrollHeight - host.scrollTop - host.clientHeight < NEAR
  }

  const jump = (): void => {
    if (!shown()) return
    const host = scrollPane()
    if (host === undefined) return
    host.scrollTop = host.scrollHeight
    assignedTop = host.scrollTop
    measure(host)
  }
  const scrolled = () => {
    if (!shown() || restoringVisibility) return
    const host = scrollPane()
    if (host === undefined) return
    const moved = measure(host)
    // Browser anchoring can move the scroll forward before ResizeObserver
    // sees new rows. While following, that forward move is not a reader
    // scrolling away — and neither is a move, either way, of exactly what
    // the rows' start moved by (`measure`). A move that is neither is a hand,
    // and an upward one releases following at once. Within two pixels, not
    // one: `scrollTop` is the browser's rounding of a fractional layout, and a
    // six-and-a-half-pixel head reads as six here and seven there.
    const anchored = moved.above !== 0 && Math.abs(moved.top - moved.above) < 2
    if (Number.isFinite(assignedTop) && (Math.abs(host.scrollTop - assignedTop) < 1
      || (following && (host.scrollTop > assignedTop || anchored)))) {
      if (following && host.scrollTop !== assignedTop) jump()
      return
    }
    following = atBottom()
  }

  let listening: Window | HTMLElement | undefined
  let scrollMode: string | undefined
  const bindScroll = () => {
    if (!props.page || !pane || !shown()) return
    const mode = `${router?.split() === true}:${window.matchMedia("(min-width: 48rem)").matches}`
    if (outer !== undefined && scrollMode === mode) return
    scrollMode = mode
    let parent = pane.parentElement
    while (parent !== null && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement
    const next = parent ?? document.documentElement
    if (outer !== next) {
      if (outer !== undefined) grown?.unobserve(outer)
      outer = next
      grown?.observe(outer)
    }
    const target = outer === document.documentElement ? window : outer
    measure(next)
    if (listening === target) return
    listening?.removeEventListener("scroll", scrolled)
    listening = target
    target.addEventListener("scroll", scrolled, { passive: true })
  }
  onCleanup(() => listening?.removeEventListener("scroll", scrolled))
  createEffect(on([shown, () => router?.split()], ([visible]) => {
    restoringVisibility = true
    if (!visible) return
    const frame = requestAnimationFrame(() => { bindScroll(); if (following) jump(); restoringVisibility = false })
    onCleanup(() => cancelAnimationFrame(frame))
  }))
  onMount(() => {
    if (content === undefined || pane === undefined) return
    bindScroll()
    if (props.page) jump()
    // Content growing does NOT move `scrollTop`, so the browser fires no scroll
    // event for it. New text is followed from here. The jump's own `scroll`
    // arrives later and is recognised by `assignedTop`, not by a flag.
    grown = new ResizeObserver(() => {
      if (following) jump()
    })
    grown.observe(content)
    grown.observe(pane)
    if (props.page) {
      if (outer !== undefined) grown.observe(outer)
      const resized = () => { bindScroll(); if (following) jump() }
      window.addEventListener("resize", resized)
      onCleanup(() => window.removeEventListener("resize", resized))
    }
    onCleanup(() => grown?.disconnect())
  })

  createEffect(
    on(
      () => props.chat.state().session?.id,
      () => {
        following = true
        jump()
      },
    ),
  )

  const waitingForms = createWaitingForms()
  createEffect(() => {
    if (!shown() || !revealing()) return
    const waiting = waitingForms.first() ?? null
    if (waiting === null && !wholeYet(props.chat.rows(), (key) => props.chat.entry(key)())) {
      return
    }
    following = true
    if (waiting === null) jump()
    else waiting.scrollIntoView({ block: "center" })
    revealed()
  })

  const previousOf = createPrevious(() => props.chat.rows())

  const titleOf = (key: string): string | undefined => {
    const frame = props.chat.entry(key)()
    return sentOf(frame) ?? frame?.text
  }

  const agent = createMemo(
    () => agentIn(props.chat.state()) ?? undefined,
    undefined,
    { equals: (one, other) => one?.id === other?.id && one?.name === other?.name },
  )

  return (
    <WaitingFormsProvider value={waitingForms}>
    <div
      // `min-h-0` is what makes THIS the scroller: `flex-1` with the default
      // `min-height: auto` will not shrink below the content, so the parent
      // (`./DropTarget.tsx`) would become the scrollport instead.
      // `overscroll-contain` stops a wheel at the end of this pane from moving
      // the page beside it.
      style={{ "max-height": props.page ? undefined : "24rem" }}
      class="min-w-0 px-3 py-2 text-ink"
      classList={{
        "olai-scroll flex-1 overflow-x-hidden overflow-y-auto overscroll-contain": !props.page,
        "min-h-0": previewing() === null,
        "min-h-[7rem]": previewing() !== null,
      }}
      data-testid={TESTID.chatTranscript}
      ref={pane}
      onScroll={props.page ? undefined : scrolled}
    >
      <div class="min-w-0" ref={content}>
        <Show when={props.chat.earlier() > 0}>
          <div class="flex justify-center py-1">
            <button
              type="button"
              data-testid={TESTID.chatEarlier}
              data-earlier={props.chat.earlier()}
              disabled={props.chat.earlierLoading()}
              class="flex h-8 items-center rounded-control border border-rule px-3 text-label text-muted hover:text-ink disabled:opacity-60"
              onClick={() => props.chat.loadEarlier()}
            >
              {props.chat.earlierLoading()
                ? "Loading earlier messages…"
                : `Earlier messages (${props.chat.earlier()})`}
            </button>
          </div>
        </Show>
        <For each={props.chat.rows()}>
          {(key) => {
            const entry = props.chat.entry(key)
            const previousKey = previousOf(key)
            const above = createMemo(() => {
              const previous = previousKey()
              return previous === undefined
                ? undefined
                : props.chat.entry(previous)()
            })
            const lane = createMemo(() => laneOf(entry(), above(), titleOf), undefined, { equals: (a, b) => a?.parent === b?.parent && a?.label === b?.label })
            const working = createMemo(() => railOf(entry()), null, { equals: sameRail })
            const speaker = createMemo((): Faced | null => {
              const party = facedAt(entry(), above())
              return party === null ? null : { party, agent: agent() }
            }, null, { equals: (a, b) => a?.party.of === b?.party.of &&
              (a?.party.of !== "plugin" || b?.party.of === "plugin" && a.party.name === b.party.name) &&
              a?.agent?.id === b?.agent?.id && a?.agent?.name === b?.agent?.name })
            return (
              <Show when={entry()}>
                {(row) => (
                  <Row
                    entry={row()}
                    chat={props.chat}
                    lane={lane()}
                    rail={working()}
                    speaker={speaker()}
                  />
                )}
              </Show>
            )
          }}
        </For>

        <Show when={props.chat.refused()}>
          {(failure) => (
            <div class="mt-2" data-testid={TESTID.chatRefused}>
              <Refusal failure={failure()} />
            </div>
          )}
        </Show>

        <Show when={props.chat.state().trouble}>
          {(trouble) => (
            <p class="mt-2 text-label text-alarm" data-testid={TESTID.chatTrouble}>
              {trouble()}
            </p>
          )}
        </Show>

        <Show when={declaringFailure()}>
          {(why) => (
            <SaidLine
              said={{ tone: "alarm", text: `Some links couldn't be found. ${why()}` }}
              class="m-0 mt-2 text-label"
              testid={TESTID.chatRefsFailure}
            />
          )}
        </Show>

      </div>
    </div>
    </WaitingFormsProvider>
  )
}
