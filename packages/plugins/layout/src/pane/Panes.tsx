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
import { createSignal,createMemo,createSelector,For,onCleanup,Show } from "solid-js"

import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { WITHIN } from "@olai/web/client/layer.ts"
import { drag as pointerDrag } from "@olai/web/client/pointer.ts"

import { PaneProvider } from "olai-plugin-navigation/pane"
import { RouterProvider, ShownProvider, useRouter } from "olai-plugin-navigation/routing"
import {
flexOf,
isLone,
panesOf,
type Pane,
} from "olai-plugin-navigation/workspace"
import { desktop } from "../layout/live.ts"
import { PANES_LONE,PANES_SPLIT } from "../layout/sheet.ts"
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

function LanePanes(props: { readonly page: Navigation["page"] }) {
  const router = useRouter()
  const columns = createMemo(() => router.split() && desktop())
  const focused = createSelector(router.focusIndex)
  const scrolls = new Map<HTMLElement, { top: number; left: number }>()
  let alive = true
  onCleanup(() => { alive = false; scrolls.clear() })
  // Read positions before the host's display binding hides it. Restore after
  // it has geometry, before transcript followers perform their next-frame jump.
  const visible = createMemo(() => {
    const shown = router.shown()
    if (!shown) {
      for (const host of scrolls.keys()) scrolls.set(host, { top: host.scrollTop, left: host.scrollLeft })
    } else queueMicrotask(() => {
      if (!alive || !router.shown()) return
      for (const [host, at] of scrolls) { host.scrollTop = at.top; host.scrollLeft = at.left }
    })
    return shown
  })
  let row: HTMLDivElement | undefined
  const [live, setLive] = createSignal<ReadonlyArray<number> | undefined>()
  const grow = createMemo(() => live() ?? flexOf(router.panes().map(pane => ({ route: pane.route(), width: pane.width() }))))
  return <div data-testid={TESTID.lane} data-lane-front={String(visible())}
    class="flex min-w-0 flex-col bg-paper"
    style={{ display: visible() ? undefined : "none", "overflow-anchor": "none" }}
    classList={{ [PANES_SPLIT]: router.split(), [PANES_LONE]: !router.split() }}>
    <Show when={router.split() && !desktop()}><TabStrip /></Show>
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
            classList={{ "ring-2 ring-inset ring-accent": columns() && focused(pane.index()) }}>
            <Show when={columns()}><Header index={pane.index()} pane={reading()} row={() => row} focused={() => focused(pane.index())} /></Show>
            <div ref={host => { scrolls.set(host, { top: 0, left: 0 }); onCleanup(() => scrolls.delete(host)) }} class="flex min-h-0 flex-1 flex-col" classList={{ "overflow-y-auto": columns() }}
              style={{ "--height-chrome": columns() ? "0px" : undefined }}>
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

function Header(props: { readonly index: number; readonly pane: Pane; readonly row: () => HTMLDivElement | undefined; readonly focused: () => boolean }) {
  const router = useRouter()
  const focused = props.focused
  let stop: (() => void) | undefined
  onCleanup(() => stop?.())

  return (
    <div
      class="flex shrink-0 cursor-grab items-center gap-1 border-b border-rule/60 bg-desk px-2 py-1"
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
      class="flex w-9 shrink-0 flex-col items-center gap-2 border-x border-rule/60 bg-desk py-3 text-muted hover:text-ink"
      classList={{ "ring-2 ring-inset ring-accent": focused() }}
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

function TabStrip() {
  const router = useRouter()
  const isFocused = createSelector(router.focusIndex)
  return (
    <div
      class="flex shrink-0 gap-1 overflow-x-auto border-b border-rule/60 bg-desk px-2 py-1"
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
              class="shrink-0 truncate rounded-control px-2 py-1 text-label text-muted hover:text-ink"
              classList={{
                "bg-panel text-ink ring-1 ring-accent": focused(),
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
