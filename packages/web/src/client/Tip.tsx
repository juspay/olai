/**
 * A hover tip, drawn by this app rather than by the platform.
 *
 * The `title` attribute was doing this job and doing two things wrong: it is
 * placed by the browser, which ran a long one off the right edge of the
 * window, and it is hover-only, so what it said was unavailable to anyone
 * reading with a keyboard or a screen reader. The second half is not solved
 * here — an `aria-label` on the control says the same sentence, which is what
 * makes this tip a convenience rather than the only copy.
 *
 * It shows on hover AND on focus, because a control you can tab to is one you
 * can ask about; it hides on leave, blur, Escape, a scroll, and — the one that
 * matters most — the moment any OTHER tip opens (./tip.ts holds that, because
 * "only one is on screen" is a fact about the page rather than about any tip
 * in it). It also hides when whatever it belongs to is disposed, since a tip
 * outliving its control is a sentence about nothing.
 *
 * `position: fixed` AND in a portal at the end of the document, which are two
 * different escapes and it needs both. Fixed places it against the WINDOW
 * rather than against whatever the row is inside — a tree row is inside a
 * scrolling pane inside a flex column. The portal takes it out of the row's
 * SUBTREE, and the reason is on a screenshot: a blocked row is dimmed
 * (`./blocked.ts`), opacity applies to a whole subtree including anything
 * fixed inside it, and a tip at 60% let the note underneath show straight
 * through its own words — two overlapping sentences, unreadable, which is what
 * a reader would call a doubled tooltip. Nothing about a tip belongs to the
 * row's box; it only belongs to the row's meaning.
 *
 * Where it lands is `./tip.ts`, measured after it draws because a tip's width
 * is a fact about the text and the window rather than one we can be told.
 */

import { createSignal, type JSX, onCleanup, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { LAYER } from "./layer.ts"
import { TESTID } from "./testids.ts"
import { clampedLeft, clampedTop, hideTip, showTip, takeTip, tipShowing } from "./tip.ts"

interface At {
  readonly left: number
  readonly top: number
}

export function Tip(props: {
  /** What the tip says. The control it wraps says the same thing in its
   *  `aria-label`, so this is never the only copy. */
  readonly text: string
  /** The control being explained. */
  readonly children: JSX.Element
  /**
   * Which of the page's stack this tip rides. Defaults to the page: a tip
   * about a row stays under the chrome, which is what leaves the bar
   * reachable (#101). A tip about a HEADER PILL has to cover the bar —
   * and the chat dock that shares the page layer — which is
   * {@link LAYER.over}, the same claim the panel behind that pill already
   * makes. Sitting at the page layer is how the coral rule cut the first
   * line of the sentence and how the dock's "chats" / "+ new" painted
   * through the rest.
   */
  readonly layer?: typeof LAYER.page | typeof LAYER.over
}) {
  const me = takeTip()
  const [at, setAt] = createSignal<At | undefined>()
  let anchor: HTMLSpanElement | undefined

  const show = (): void => {
    // The CONTROL's box, not this wrapper's. The wrapper is `display:
    // contents` so that it adds no box to the gutter's flex row — and an
    // element with no box has no rectangle either: `getBoundingClientRect`
    // answers all zeros, which put the first tip in the top-left corner of the
    // window, over the sidebar, nowhere near what it was about.
    const box = anchor?.firstElementChild?.getBoundingClientRect()
    if (box === undefined) return
    // Under the anchor and starting at it — but never under the header.
    // A header pill's box ends inside the bar; `./tip.ts` lifts the tip
    // to the bar's bottom edge so the coral rule cannot cut the sentence.
    // The effect below then pulls it back if that ran past the window's
    // right edge.
    const header = document.querySelector(`[data-testid="${TESTID.appHeader}"]`)
    const floor = header?.getBoundingClientRect().bottom ?? 0
    setAt({ left: box.left, top: clampedTop(box.bottom, floor) })
    showTip(me)
  }

  const hide = (): void => hideTip(me)
  // A control that goes away under the pointer takes its tip with it: a row
  // that was folded away, a page that was left.
  onCleanup(hide)

  const place = (tip: HTMLDivElement): void => {
    const box = tip.getBoundingClientRect()
    const left = clampedLeft(box.left, box.width, window.innerWidth)
    if (left !== box.left) setAt((was) => was === undefined ? was : { ...was, left })
  }

  /** The tip itself, in a portal at the end of the document. Its own component
   *  so that `onMount` belongs to IT — the measurement has to happen once the
   *  tip is in the page, and the row that owns the hover mounted long ago. */
  const Drawn = (drawn: { readonly at: At }) => {
    let tip: HTMLDivElement | undefined
    // `onMount`, not the `ref` callback: a ref fires while the element is still
    // detached, where its rectangle is all zeros — which read as "this tip
    // starts at the left edge of the window" and pinned every one to the
    // margin.
    onMount(() => {
      if (tip !== undefined) place(tip)
      // A fixed tip does not scroll with what it is about, so the pane moving
      // under it is the same news as the pointer leaving. Captured, because it
      // is the pane that scrolls rather than the window.
      window.addEventListener("scroll", hide, { capture: true, passive: true })
      onCleanup(() => window.removeEventListener("scroll", hide, true))
    })

    return (
      <div
        ref={tip}
        class={`pointer-events-none fixed ${props.layer ?? LAYER.page} max-w-[min(24rem,calc(100vw-1rem))] rounded-sm border border-rule/70 bg-panel px-2 py-1 text-xs text-ink shadow-sm`}
        style={{ left: `${drawn.at.left}px`, top: `${drawn.at.top}px` }}
        data-testid={TESTID.tip}
        role="presentation"
      >
        {props.text}
      </div>
    )
  }

  return (
    <span
      ref={anchor}
      class="contents"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusIn={show}
      onFocusOut={hide}
      onKeyDown={(event) => {
        if (event.key === "Escape") hide()
      }}
    >
      {props.children}
      <Show when={tipShowing(me) ? at() : undefined}>
        {(spot) => (
          <Portal>
            <Drawn at={spot()} />
          </Portal>
        )}
      </Show>
    </span>
  )
}
