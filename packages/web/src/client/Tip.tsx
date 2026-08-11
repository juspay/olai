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
 * `position: fixed`, so it is placed against the WINDOW rather than against
 * whatever the row happens to be inside — a tree row is inside a scrolling pane
 * inside a flex column, and an absolutely positioned tip would inherit every
 * one of those boxes. Where it lands is `./tip.ts`, measured after it draws
 * because a tip's width is a fact about the text and the window rather than one
 * we can be told.
 */

import { createSignal, type JSX, onCleanup, onMount, Show } from "solid-js"

import { TESTID } from "./testids.ts"
import { clampedLeft, hideTip, showTip, takeTip, tipShowing } from "./tip.ts"

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
    // Under the anchor and starting at it; the effect below pulls it back if
    // that turned out to run past the window's right edge.
    setAt({ left: box.left, top: box.bottom + 4 })
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
        {(spot) => {
          let tip: HTMLDivElement | undefined
          // `onMount`, not the `ref` callback: a ref fires while the element is
          // still detached, where its rectangle is all zeros — which read as
          // "this tip starts at the left edge of the window" and pinned every
          // one of them to the margin.
          onMount(() => {
            if (tip !== undefined) place(tip)
            // A fixed tip does not scroll with what it is about, so the pane
            // moving under it is the same news as the pointer leaving.
            // Captured, because the pane scrolls rather than the window.
            const away = (): void => hide()
            window.addEventListener("scroll", away, { capture: true, passive: true })
            onCleanup(() => window.removeEventListener("scroll", away, true))
          })
          return (
            <div
              ref={tip}
              class="pointer-events-none fixed z-30 max-w-[min(24rem,calc(100vw-1rem))] rounded-sm border border-rule bg-paper px-2 py-1 text-xs text-ink shadow-sm"
              style={{ left: `${spot().left}px`, top: `${spot().top}px` }}
              data-testid={TESTID.tip}
              role="presentation"
            >
              {props.text}
            </div>
          )
        }}
      </Show>
    </span>
  )
}
