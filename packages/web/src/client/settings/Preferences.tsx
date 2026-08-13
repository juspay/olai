/**
 * The way into the preferences: one control in the app header, and the panel it
 * opens.
 *
 * It is in the HEADER because the header carries what is about the APP and the
 * sidebar what is about the DIRECTORY (`../AppHeader.tsx`), and how this
 * browser reads is a fact about the app in every directory it is pointed at.
 *
 * It REPLACED the theme pill rather than joining it. The pill was a preference
 * with a control of its own outside the place preferences are set, and a bar
 * that has six things in it at 390pt cannot spend one of them on a second door
 * to a panel that is already there — the same argument `one-git-indicator`
 * settled for the two git chips. What the pill promised (it NAMED the theme in
 * force) is kept: the theme row's hint names it, one gesture further in, and
 * the page itself is painted in it — which is the difference from the
 * connection and the commit pill, whose facts are invisible unless a control
 * says them and which therefore may never be a gesture away.
 *
 * WHERE THE PANEL GOES is not the header's to decide: the bar is `sticky` with
 * a z-index, which makes it a stacking context and a 3rem-tall box. So the
 * panel is portalled out of it and positioned against the VIEWPORT
 * (`../anchor.ts`), exactly as the Commit panel beside it is, and it opens
 * downward because that is the side with the room.
 *
 * Dismissal is a pointer outside it, Escape, or the trigger again — and the two
 * that a keyboard can reach put focus back on the trigger, because somebody who
 * opened this, tabbed into it and pressed Escape would otherwise land on
 * `<body>`. That behaviour came with the theme popover this replaced; it is
 * kept here rather than lost with it.
 */

import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { type Anchor, anchoredTo } from "../anchor.ts"
import { Panel } from "./Panel.tsx"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"

export function Preferences() {
  const [open, setOpen] = createSignal(false)
  const [anchor, setAnchor] = createSignal<Anchor | null>(null)

  let trigger: HTMLButtonElement | undefined
  let panel: HTMLElement | undefined

  /** Shut it, and put focus back on the trigger when the dismissal came from a
   *  key rather than from a pointer that has already gone somewhere. */
  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) trigger?.focus()
  }

  /** Re-read where the trigger is. It has to happen again whenever the window
   *  or the page under it moves: an anchored popover that goes stale on a
   *  scroll is worse than one that never moved at all. */
  const measure = () => {
    if (trigger === undefined) return
    setAnchor(anchoredTo(trigger.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight,
    }))
  }

  // Scoped to the open state, so a shut panel is not three document listeners
  // for nothing.
  createEffect(() => {
    if (!open()) return
    measure()
    const onPointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      // Two roots, not one: the trigger and the portalled panel are siblings in
      // different corners of the document, so neither is an ancestor that could
      // speak for the other.
      if (trigger?.contains(target) || panel?.contains(target)) return
      close(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      close(true)
    }
    // Capture, so a press that also navigates still closes this first.
    document.addEventListener("pointerdown", onPointer, true)
    document.addEventListener("keydown", onKey)
    window.addEventListener("resize", measure)
    // Capture for `scroll` too: what moves under the panel may be a column
    // rather than the document, and a scroll event does not bubble.
    document.addEventListener("scroll", measure, true)
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointer, true)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", measure)
      document.removeEventListener("scroll", measure, true)
    })
  })

  return (
    <>
      <button
        type="button"
        ref={trigger}
        // `TARGET_BOX` for the reason the burger and the agent toggle carry it:
        // a glyph on its own is a target a finger misses sideways as well as
        // vertically. Released on a pointer (`md:`).
        class={`inline-flex shrink-0 items-center justify-center gap-1 rounded-full border border-rule bg-paper px-2 py-1.5 font-mono text-xs hover:text-ink sm:px-3 ${TARGET_BOX} md:min-h-0 md:min-w-0 ${
          open() ? "border-accent text-ink" : "text-muted"
        }`}
        data-testid={TESTID.prefsTrigger}
        aria-expanded={open()}
        aria-haspopup="true"
        title="preferences: theme, and what a page does with finished work"
        onClick={() => (open() ? close(true) : setOpen(true))}
      >
        {/* The word is `sr-only` below 40rem, exactly as the agent toggle's is:
            the glyph is already an icon, the accessible name is unchanged, and
            what a bar this size gives up is pixels rather than meaning. */}
        <span aria-hidden="true">⚙</span>
        <span class="sr-only sm:not-sr-only">prefs</span>
      </button>
      {/* Out of the header entirely — see this file's header. */}
      <Show when={open() ? anchor() : null}>
        {(at) => (
          <Portal>
            <Panel
              at={at()}
              inside={(el) => {
                panel = el
              }}
            />
          </Portal>
        )}
      </Show>
    </>
  )
}
