import { createWaitingForms, WaitingFormsProvider } from "./waiting-forms.ts"
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

interface Follower {
  readonly following: () => boolean
  readonly follow: () => void
  readonly jumped: (host: HTMLElement) => void
  readonly rebase: (host: HTMLElement) => void
  readonly scrolled: (host: HTMLElement) => "rejump" | "settled"
}

const createFollower = (startOf: (host: HTMLElement) => number): Follower => {
  let following = true
  // Chromium (149, and the suite's Playwright) dispatches `scroll`
  // asynchronously, at a rendering update, so a flag held across the
  // assignment is already false when the handler runs. What is remembered
  // instead is the `scrollTop` that was assigned.
  let assignedTop = Number.NaN
  // The browser's scroll anchoring keeps the row under the reader's eye still
  // while something ABOVE it grows or shrinks, by moving `scrollTop` by
  // exactly that much — forward when the head grew, back when it shrank.
  let seenStart = Number.NaN
  let seenTop = Number.NaN

  const measure = (host: HTMLElement): { readonly above: number; readonly top: number } => {
    const start = startOf(host)
    const moved = { above: start - seenStart, top: host.scrollTop - seenTop }
    seenStart = start
    seenTop = host.scrollTop
    return moved
  }

  return {
    following: () => following,
    follow: () => { following = true },
    jumped: (host) => {
      assignedTop = host.scrollTop
      measure(host)
    },
    rebase: (host) => { measure(host) },
    scrolled: (host) => {
      const moved = measure(host)
      // Within two pixels, not one: `scrollTop` is the browser's rounding of a
      // fractional layout, and a six-and-a-half-pixel head reads as six here
      // and seven there.
      const anchored = moved.above !== 0 && Math.abs(moved.top - moved.above) < 2
      if (Number.isFinite(assignedTop) && (Math.abs(host.scrollTop - assignedTop) < 1
        || (following && (host.scrollTop > assignedTop || anchored)))) {
        return following && host.scrollTop !== assignedTop ? "rejump" : "settled"
      }
      following = host.scrollHeight - host.scrollTop - host.clientHeight < NEAR
      return "settled"
    },
  }
}

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
  let restoringVisibility = true
  const startOf = (host: HTMLElement): number => {
    if (pane === undefined || host === pane) return 0
    const top = pane.getBoundingClientRect().top
    return host === document.documentElement ? top + window.scrollY : top - host.getBoundingClientRect().top + host.scrollTop
  }
  const follower = createFollower(startOf)

  const jump = (): void => {
    if (!shown()) return
    const host = scrollPane()
    if (host === undefined) return
    host.scrollTop = host.scrollHeight
    follower.jumped(host)
  }
  const scrolled = () => {
    if (!shown() || restoringVisibility) return
    const host = scrollPane()
    if (host === undefined) return
    if (follower.scrolled(host) === "rejump") jump()
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
    follower.rebase(next)
    if (listening === target) return
    listening?.removeEventListener("scroll", scrolled)
    listening = target
    target.addEventListener("scroll", scrolled, { passive: true })
  }
  onCleanup(() => listening?.removeEventListener("scroll", scrolled))
  createEffect(on([shown, () => router?.split()], ([visible]) => {
    restoringVisibility = true
    if (!visible) return
    const frame = requestAnimationFrame(() => { bindScroll(); if (follower.following()) jump(); restoringVisibility = false })
    onCleanup(() => cancelAnimationFrame(frame))
  }))
  onMount(() => {
    if (content === undefined || pane === undefined) return
    bindScroll()
    if (props.page) jump()
    // Content growing does NOT move `scrollTop`, so the browser fires no
    // scroll event for it.
    grown = new ResizeObserver(() => {
      if (follower.following()) jump()
    })
    grown.observe(content)
    grown.observe(pane)
    if (props.page) {
      if (outer !== undefined) grown.observe(outer)
      const resized = () => { bindScroll(); if (follower.following()) jump() }
      window.addEventListener("resize", resized)
      onCleanup(() => window.removeEventListener("resize", resized))
    }
    onCleanup(() => grown?.disconnect())
  })

  createEffect(
    on(
      () => props.chat.state().session?.id,
      () => {
        follower.follow()
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
    follower.follow()
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
      // `min-h-0`: a flex item's default `min-height: auto` will not shrink
      // below its content, so an ancestor would become the scrollport instead.
      // `overscroll-contain` stops a wheel at the end of this pane from
      // chaining to the page beside it.
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
