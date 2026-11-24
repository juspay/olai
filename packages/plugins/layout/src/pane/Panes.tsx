/**
 * The pane list, as a row of pages or a strip of tabs.
 *
 * On a desktop the workspace is columns: each pane is the full page
 * component (`./PageView.tsx`), a divider between them resizes, a pane
 * below the minimum width collapses to a labelled rail (click expands —
 * collapse and close are different verbs), and dragging a header reorders.
 * On a narrow screen the same list projects to a tab strip over one
 * column. The URL is the list either way (`../workspace.ts`).
 *
 * One pane is a plain page: no header, no ring, no rail. Closing the
 * second-to-last returns to that.
 */
import { TESTID } from "olai-plugin-layout/testids"
import type {Navigation} from "olai-plugin-navigation/contract"
import { createSignal,createMemo,createSelector,createComputed,createEffect,on,For,onCleanup,Show } from "solid-js"

import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { LAYER, WITHIN } from "@olai/web/client/layer.ts"
import { drag as pointerDrag } from "@olai/web/client/pointer.ts"

import { PaneProvider } from "olai-plugin-navigation/pane"
import { RouterProvider, ShownProvider, useRouter } from "olai-plugin-navigation/routing"
import {
flexOf,
isLone,
panesOf,
type Pane,
} from "olai-plugin-navigation/workspace"
import { desktop, holdPhoneTabs } from "../layout/live.ts"
import { SHELL_LONE,SHELL_SPLIT } from "../layout/sheet.ts"
import { PANE_RAIL_PX,snap } from "./geometry.ts"
import { nameOf } from "../routing.ts"

export { PANE_MIN_PX,PANE_RAIL_PX } from "./geometry.ts"

/** Layout owns hosts, navigation owns lane state. Visibility never replaces a
 * host or its page; a lane leaving the declared list is the disposal boundary. */
export function Panes() {
  const nav = useRouter() as Navigation
  return <For each={nav.lanes()}>{lane =>
    <RouterProvider router={lane}>
      <LanePanes page={nav.page} />
    </RouterProvider>
  }</For>
}

/** The gestures that end a restore in flight: a reader who has taken the page
 *  over owns where it is (`olai-plugin-navigation`'s `scroll.ts`, the same
 *  discipline and the same list). */
const TAKEOVER = ["wheel", "touchstart", "keydown", "pointerdown"] as const

function LanePanes(props: { readonly page: Navigation["page"] }) {
  const router = useRouter()
  const columns = createMemo(() => router.split() && desktop())
  const focused = createSelector(router.focusIndex)
  let host: HTMLDivElement | undefined
  const [laneBox, setLaneBox] = createSignal<DOMRect>()
  const scrolls = new Map<HTMLElement, Scroll>()
  let alive = true
  onCleanup(() => { alive = false; scrolls.clear() })
  // Read positions and the lane box before hiding its contents. Restore after
  // it has geometry, before transcript followers perform their next-frame jump.
  const visible = router.shown
  createComputed(on(visible, shown => {
    if (!shown) {
      const box = host?.getBoundingClientRect()
      if (box && box.width > 0 && box.height > 0) setLaneBox(box)
      for (const host of scrolls.keys()) scrolls.set(host, readScroll(host))
    }
  }))
  createEffect(on(visible, shown => {
    if (shown) queueMicrotask(() => {
      if (!alive || !router.shown()) return
      for (const [host, at] of scrolls) restoreScroll(host, at)
    })
  }))
  let row: HTMLDivElement | undefined
  const [live, setLive] = createSignal<ReadonlyArray<number> | undefined>()
  const grow = createMemo(() => live() ?? flexOf(router.panes().map(pane => ({ route: pane.route(), width: pane.width() }))))
  /**
   * EACH TAB KEEPS ITS OWN PLACE — the phone's half of what a column gets for
   * free.
   *
   * A split below `md` is one strip of tabs over one page, and the thing that
   * scrolls there is the DOCUMENT: the lane grows with whatever tab is drawn
   * (above), so the window's scroll is shared by every tab in it. Switching
   * from a note read at its top to a chat landed at the top of the
   * conversation — nine thousand pixels above its newest line — and switching
   * back and forth drifted, because each arrival inherited wherever the one
   * before it had left the window.
   *
   * So the place is remembered per PANE, and the two halves are two phases of
   * one update: the leaving tab's position is read in a `createComputed`,
   * which runs before the DOM is touched and therefore still measures the
   * page that is on screen, and the arriving tab's is put back in a
   * `createEffect`, after the swap. A tab nobody has read yet starts at the
   * top, which is where a chat's own transcript takes over and goes to its
   * end (`olai-plugin-chat`'s `Transcript.tsx`, whose follow runs on the next
   * frame and so lands after this).
   *
   * BY PANE ID rather than by index: opening and closing renumber the panes,
   * and an index remembered across a splice is another pane's place.
   *
   * ...AND BY THE PAGE AS WELL AS THE PANE. A tab is a column, not a
   * document: the page in it changes — a link an agent wrote opens in the
   * OTHER tab, which is a page arriving in a tab somebody had left part way
   * down a note. A place kept by tab alone is then offered to a page nobody
   * has read a word of, and the note's own place is lost the moment that tab
   * shows anything else. So a place belongs to the PAIR, and the pair is what
   * is written down when a tab is left and what is asked for when one comes
   * back: a page this tab has not shown opens at its top, and the note comes
   * back where the reader was.
   *
   * BY THE PAGE'S OWN ADDRESS (`routes.href`), which is the app's one answer
   * to "the same page": a filter narrowed is a different address and starts
   * again, which is the same bargain a column's own scrollport strikes.
   *
   * WRITTEN DOWN WHENEVER EITHER HALF CHANGES, and put back only when the
   * TAB does. A page replaced inside the tab in front is a NAVIGATION, and
   * where a navigation leaves the page is navigation's own rule — to the top
   * for a press, back to the line it was left on for a Back
   * (`olai-plugin-navigation`'s `scroll.ts`); a second opinion from here
   * would be two restores racing over one window.
   */
  const tabbed = createMemo(() => router.split() && !desktop())
  const places = new Map<string, number>()
  /** The tab in front and the page it is showing — the pair a place belongs
   *  to. A memo of both, so what `on` hands back as `before` is the pane AND
   *  the page it was showing while it was on screen. */
  const front = createMemo(() => {
    const pane = router.panes()[router.focusIndex()]
    return pane === undefined ? undefined : { id: pane.id, page: router.routes.href(pane.route()) }
  })
  const placeOf = (at: { readonly id: string; readonly page: string }): string => `${at.id}\n${at.page}`
  createComputed(on(front, (now, before) => {
    if (!tabbed() || before === undefined || before.id === now?.id && before.page === now.page) return
    places.set(placeOf(before), window.scrollY)
  }))
  /** The restore still being asked for, while the arriving tab is short of
   *  the place it was left. */
  let asking: (() => void) | undefined
  onCleanup(() => asking?.())
  const stand = (top: number): void => {
    asking?.()
    asking = undefined
    window.scrollTo({ top, behavior: "instant" })
    if (top === 0 || window.scrollY >= top) return
    // SHORT OF IT, so the arriving tab has not finished laying out: a page
    // that was `display: none` a moment ago is measured from what its blocks
    // say they are, and the real height arrives as they are drawn. The window
    // clamps a scroll to the height it has at that instant, so the ask is
    // repeated as the page GROWS — not on a clock and not frame by frame:
    // a growth is the only event that can change the answer, and the reader
    // taking the page over ends it at once.
    const stop = (): void => {
      growing.disconnect()
      for (const gesture of TAKEOVER) removeEventListener(gesture, stop)
      asking = undefined
    }
    const growing = new ResizeObserver(() => {
      window.scrollTo({ top, behavior: "instant" })
      if (window.scrollY >= top) stop()
    })
    asking = stop
    for (const gesture of TAKEOVER) addEventListener(gesture, stop, { passive: true })
    growing.observe(document.documentElement)
  }
  createEffect(on(front, (now, before) => {
    if (!tabbed() || now === undefined || before === undefined || before.id === now.id) return
    // Reading the height first is what makes the restore land at all: the
    // arriving tab was `display: none`, and a window asked to scroll before
    // anything of that page has been laid out is clamped to the height of the
    // page it replaced.
    void document.documentElement.scrollHeight
    stand(places.get(placeOf(now)) ?? 0)
  }))
  // THE STRIP, SAID OUT LOUD while this lane draws one: what the document
  // reserves at its top for an in-page jump is the bar plus this strip, and
  // that is written on `:root` from outside every lane (`../layout/css.ts`).
  // The lane in front is the one that counts — a hidden lane's strip is not
  // over anybody's page.
  createEffect(() => {
    if (visible() && tabbed()) onCleanup(holdPhoneTabs())
  })
  return <div ref={host} data-testid={TESTID.lane} data-lane-front={String(visible())}
    class="flex min-w-0 flex-col bg-paper"
    style={{
      "content-visibility": visible() ? undefined : "hidden",
      visibility: visible() ? undefined : "hidden",
      position: visible() ? undefined : "fixed",
      "pointer-events": visible() ? undefined : "none",
      overflow: visible() ? undefined : "hidden",
      left: visible() ? undefined : `${laneBox()?.x ?? 0}px`,
      top: visible() ? undefined : `${laneBox()?.y ?? 0}px`,
      width: visible() ? undefined : `${laneBox()?.width ?? 0}px`,
      height: visible() ? undefined : `${laneBox()?.height ?? 0}px`,
      "overflow-anchor": "none",
    }}
    // COLUMNS ARE A VIEWPORT-HEIGHT BOX, one scrollport each; a phone is one
    // page under a strip of tabs and scrolls the DOCUMENT, so the lane there
    // GROWS with what is in it exactly as a lone page does. A split clamped
    // to the viewport on a phone was the bug behind "the way back scrolls
    // away": a `sticky` child is held by its own containing block, so a strip
    // pinned inside a box one screen tall left the screen on the second
    // screen of a long conversation.
    classList={{ [SHELL_SPLIT]: columns(), [SHELL_LONE]: !columns() }}>
    <Show when={tabbed()}><TabStrip /></Show>
    <div ref={row} class="flex min-h-0 min-w-0 flex-1">
      <For each={router.panes()}>{pane => {
        let element: HTMLDivElement | undefined
        const share = createMemo(() => grow()[pane.index()] ?? 0)
        const drawn = createMemo(() => !router.split() || (columns() ? share() > 0 : focused(pane.index())))
        const shown = createMemo(() => router.shown() && drawn())
        const reading = () => ({ route: pane.route(), width: pane.width() })
        return <>
          <Show when={columns() && pane.index() > 0}>
            <Divider left={pane.index() - 1} right={pane.index()} row={() => row} onLive={setLive} />
          </Show>
          <Show when={columns() && share() === 0}><Rail index={pane.index()} pane={reading()} focused={() => focused(pane.index())} /></Show>
          <div ref={root => { element = root; onCleanup(pane.mount(root)) }} class="flex min-h-0 min-w-0 flex-col"
            data-pane-id={pane.id}
            style={{ display: drawn() ? undefined : "none", "flex-grow": columns() ? String(share()) : "1", "flex-basis": "0" }}
            // WHICH PANE HAS THE CARET, as an OUTLINE rather than a ring: a
            // Tailwind `ring` is a `box-shadow`, and High Contrast deletes
            // box-shadows outright — so the one mark that said which half of a
            // split a keystroke would land in simply vanished there. An inset
            // outline draws the same two pixels inside the same box and is a
            // real border-adjacent property the forcing repaints rather than
            // throws away.
            classList={{ "outline-2 -outline-offset-2 outline-accent": columns() && focused(pane.index()) }}>
            <Show when={columns()}><Header index={pane.index()} pane={reading()} row={() => row} focused={() => focused(pane.index())} /></Show>
            <div ref={host => { scrolls.set(host, { top: 0, left: 0, anchor: undefined }); onCleanup(() => scrolls.delete(host)) }} class="flex min-h-0 flex-1 flex-col" classList={{ "overflow-y-auto": columns() }}
              // WHAT A STICKY ROW INSIDE THIS PAGE CLEARS. A column is its own
              // scrollport and its top already clears the app's chrome, so it
              // reserves nothing; a phone reserves the bar, and the tab strip
              // under it when the lane has one, or a page's pinned head would
              // slide beneath the way back to the other tab.
              style={{ "--height-chrome": columns() ? "0px" : router.split() ? "calc(var(--height-header) + var(--height-tabs))" : undefined }}>
              <ShownProvider shown={shown}>
                <PaneProvider index={pane.index()} id={pane.id} element={element}>{props.page(pane.index)}</PaneProvider>
              </ShownProvider>
            </div>
          </div>
        </>
      }}</For>
    </div>
  </div>
}

/** Where a hidden pane was read, and the element the reader was reading. */
type Scroll = { readonly top: number; readonly left: number; readonly anchor: { readonly element: Element; readonly y: number } | undefined }

/** The browser's scroll anchoring does not run for a hidden lane: its
 * content is not laid out. Something above the reader that resizes meanwhile
 * (a pinned head losing its "Working…" line) would move the text under a
 * restored pixel offset. So remember the deepest in-flow element at the top
 * of the scrollport, as the browser picks one, and put it back where it was.
 * Like the browser's, a scrollport at its very top has no anchor. */
function readScroll(host: HTMLElement): Scroll {
  if (host.scrollTop === 0) return { top: 0, left: host.scrollLeft, anchor: undefined }
  const top = host.getBoundingClientRect().top
  const below = (parent: Element): Element | undefined => {
    for (const child of parent.children) {
      const style = getComputedStyle(child)
      if (style.display === "contents") {
        const inner = below(child)
        if (inner !== undefined) return inner
        continue
      }
      const box = child.getBoundingClientRect()
      if (box.height > 0 && box.bottom > top && !/sticky|fixed/.test(style.position)) return child
    }
    return undefined
  }
  let anchor: Element | undefined
  for (let next = below(host); next !== undefined; next = below(next)) anchor = next
  return { top: host.scrollTop, left: host.scrollLeft, anchor: anchor && { element: anchor, y: anchor.getBoundingClientRect().top - top } }
}

function restoreScroll(host: HTMLElement, at: Scroll): void {
  host.scrollTop = at.top
  host.scrollLeft = at.left
  const anchor = at.anchor
  if (anchor === undefined || !anchor.element.isConnected || !host.contains(anchor.element)) return
  host.scrollTop += anchor.element.getBoundingClientRect().top - host.getBoundingClientRect().top - anchor.y
}

function Header(props: { readonly index: number; readonly pane: Pane; readonly row: () => HTMLDivElement | undefined; readonly focused: () => boolean }) {
  const router = useRouter()
  const focused = props.focused
  let stop: (() => void) | undefined
  onCleanup(() => stop?.())

  return (
    <div
      class="flex h-8 shrink-0 cursor-grab items-center gap-1 border-b border-rule bg-desk px-2"
      data-testid={TESTID.paneHeader}
      data-pane={String(props.index)}
      data-pane-focused={focused() ? "true" : undefined}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        if ((event.target as HTMLElement).closest("button")) return
        router.focus(props.index)
        const originX = event.clientX
        const from = props.index
        stop?.()
        stop = pointerDrag(event, {
          threshold: 8,
          onEnd: (up) => {
            stop = undefined
            if (up === null) return
            const headers = [
              ...(props.row()?.querySelectorAll(`[data-testid="${TESTID.paneHeader}"]`) ?? []),
            ]
            const overHeader = headers.find((el) => {
              const box = el.getBoundingClientRect()
              return up.clientX >= box.left && up.clientX <= box.right
            })
            const over = Number(overHeader?.getAttribute("data-pane") ?? -1)
            if (over >= 0 && over !== from) router.reorder(from, over)
            else if (Math.abs(up.clientX - originX) < 8) router.focus(from)
          },
        })
      }}
    >
      <span class="min-w-0 flex-1 truncate text-label text-muted">
        {nameOf(props.pane.route)}
      </span>
      <button
        type="button"
        class={`${TARGET_BOX} inline-flex items-center justify-center rounded-control text-muted hover:text-ink`}
        data-testid={TESTID.paneClose}
        aria-label={`Close ${nameOf(props.pane.route)}`}
        onClick={() => router.close(props.index)}
      >
        <span aria-hidden="true" class="text-title leading-none">×</span>
      </button>
    </div>
  )
}

function Rail(props: { readonly index: number; readonly pane: Pane; readonly focused: () => boolean }) {
  const router = useRouter()
  const focused = props.focused
  return (
    <button
      type="button"
      class="flex w-9 shrink-0 flex-col items-center gap-2 border-x border-rule bg-desk py-3 text-muted hover:text-ink"
      classList={{ "outline-2 -outline-offset-2 outline-accent": focused() }}
      style={{ width: `${PANE_RAIL_PX}px` }}
      data-testid={TESTID.paneRail}
      data-pane={String(props.index)}
      aria-label={`Expand ${nameOf(props.pane.route)}`}
      onClick={() => {
        router.expand(props.index)
        router.focus(props.index)
      }}
    >
      <span
        class="origin-center text-caption tracking-wide [writing-mode:vertical-rl] [text-orientation:mixed]"
      >
        {nameOf(props.pane.route)}
      </span>
    </button>
  )
}

function Divider(props: {
  readonly left: number
  readonly right: number
  readonly row: () => HTMLDivElement | undefined
  readonly onLive: (widths: ReadonlyArray<number> | undefined) => void
}) {
  const router = useRouter()
  let stop: (() => void) | undefined
  onCleanup(() => stop?.())

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panes"
      data-testid={TESTID.paneResize}
      data-left={String(props.left)}
      data-right={String(props.right)}
      class={`group relative ${WITHIN.raised} h-full w-1.5 shrink-0 cursor-col-resize touch-none self-stretch`}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        const row = props.row()
        if (row === undefined) return
        const box = row.getBoundingClientRect()
        const start = flexOf(panesOf(router.workspace()))
        const originX = event.clientX
        event.preventDefault()
        stop?.()
        stop = pointerDrag(event, {
          onMove: (move) => {
            props.onLive(snap(start, move.clientX - originX, box.width, props.left, props.right))
          },
          onEnd: (up) => {
            stop = undefined
            const last = up === null
              ? snap(start, 0, box.width, props.left, props.right)
              : snap(start, up.clientX - originX, box.width, props.left, props.right)
            props.onLive(undefined)
            router.resize(last)
          },
        })
      }}
    >
      <span
        class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-rule transition-colors group-hover:bg-accent group-active:bg-accent"
        aria-hidden="true"
      />
    </div>
  )
}

/**
 * THE PANES, ON A PHONE — one tab each, and the strip STAYS IN VIEW while the
 * page under it scrolls.
 *
 * A phone scrolls the document, so a strip in the flow scrolled away with it:
 * a reader half-way down a long conversation had no way back to the note it
 * was about without scrolling to the top first. Pinned under the header
 * (`../Header.tsx` is `sticky top-0` at `--height-header`), at the strip's own
 * layer, so it sits over the page and under anything the app puts in front.
 *
 * PINNED FOR THE WHOLE SCROLL, which is a fact about the box around it and
 * not about this class: a `sticky` row is held inside its containing block,
 * so the lane it sits in grows with the page on a phone (`LanePanes`) rather
 * than being clamped to one screen with the conversation spilling past it.
 *
 * ITS HEIGHT IS THE TABS TOKEN, because a page under it pins its own head at
 * `--height-chrome` — the bar plus this strip — and a strip whose height was
 * whatever its padding came to would be a second spelling of that sum.
 */
function TabStrip() {
  const router = useRouter()
  const isFocused = createSelector(router.focusIndex)
  return (
    <div
      class={`sticky top-[var(--height-header)] ${LAYER.strip} flex h-[var(--height-tabs)] shrink-0 items-center gap-1 overflow-x-auto border-b border-rule bg-desk px-2`}
      data-testid={TESTID.paneTabs}
      role="tablist"
      aria-label="Panes"
    >
      <For each={router.panes()}>
        {(pane, i) => {
          const focused = () => isFocused(i())
          return (
            <button
              type="button"
              role="tab"
              aria-selected={focused()}
              aria-current={focused() ? "page" : undefined}
              // `olai-tab-filled` is the forced-colours hook for a tab told by
              // its paint (`@olai/ui-primitives/all.css`), and the edge is an
              // outline rather than a `ring-1`, which is a box-shadow High
              // Contrast deletes.
              class="olai-tab-filled shrink-0 truncate rounded-control px-2 py-1 text-label text-muted hover:text-ink"
              classList={{
                "bg-panel text-ink outline-1 outline-accent": focused(),
              }}
              data-testid={TESTID.paneTab}
              data-pane={String(i())}
              onClick={() => router.focus(i())}
            >
              {nameOf(pane.route())}
            </button>
          )
        }}
      </For>
    </div>
  )
}
