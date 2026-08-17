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

import type { Agenda, Derived, OutlineError } from "@olai/format"
import { createSignal, For, Index, Show } from "solid-js"
import { onCleanup } from "solid-js"

import { Banner } from "../errors/Banner.tsx"
import { WITHIN } from "../layer.ts"
import { desktop } from "../layout/media.ts"
import { type Found } from "../page.ts"
import { drag as pointerDrag } from "../pointer.ts"
import { useRouter } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"
import {
  flexOf,
  isLone,
  type Pane,
} from "../workspace.ts"
import { PaneProvider } from "./context.tsx"
import { labelOf } from "./label.ts"
import { PageView } from "./PageView.tsx"
import { SHELL_LONE, SHELL_SPLIT } from "./shell.ts"

/** Below this, an expanded pane becomes a rail. Collapse, not close. */
export const PANE_MIN_PX = 180
/** The rail's own width — a labelled strip, not a sliver of the page. */
export const PANE_RAIL_PX = 36

export function Panes(props: {
  readonly derived: Derived | undefined
  readonly found: Found
  readonly today: string
  readonly agenda: Agenda | undefined
  readonly problems: ReadonlyArray<OutlineError>
}) {
  const router = useRouter()
  const split = () => !isLone(router.workspace())

  return (
    <div
      class="flex min-w-0 flex-col"
      classList={{
        [SHELL_SPLIT]: split(),
        [SHELL_LONE]: !split(),
      }}
    >
      <Show when={props.problems.length > 0}>
        <div class="px-4 pt-4 md:px-12 lg:pl-16">
          <Banner errors={props.problems} />
        </div>
      </Show>
      <Show when={split() && !desktop()}>
        <TabStrip />
      </Show>
      <Show
        when={split() && desktop()}
        fallback={
          <FocusedOrLone
            derived={props.derived}
            found={props.found}
            today={props.today}
            agenda={props.agenda}
          />
        }
      >
        <DesktopRow
          derived={props.derived}
          found={props.found}
          today={props.today}
          agenda={props.agenda}
        />
      </Show>
    </div>
  )
}

function FocusedOrLone(props: {
  readonly derived: Derived | undefined
  readonly found: Found
  readonly today: string
  readonly agenda: Agenda | undefined
}) {
  const router = useRouter()
  const index = () => router.workspace().focus
  return (
    <PaneProvider index={index()}>
      <PageView
        derived={props.derived}
        found={props.found}
        today={props.today}
        agenda={props.agenda}
      />
    </PaneProvider>
  )
}

function DesktopRow(props: {
  readonly derived: Derived | undefined
  readonly found: Found
  readonly today: string
  readonly agenda: Agenda | undefined
}) {
  const router = useRouter()
  let row: HTMLDivElement | undefined
  // Live fractions while a divider is held — committed to the address only
  // on release, so a pointermove is not a replaceState and a remount.
  const [live, setLive] = createSignal<ReadonlyArray<number> | undefined>()

  const grow = () => live() ?? flexOf(router.workspace().panes)

  return (
    <div ref={row} class="flex min-h-0 min-w-0 flex-1">
      <Index each={router.workspace().panes}>
        {(pane, i) => {
          // A function, not a const: Index does not re-run a slot of the
          // same length, so a captured number would stay the share the
          // pane was born with and a collapse would never become a rail.
          const share = () => grow()[i] ?? 0
          return (
            <>
              <Show when={i > 0}>
                <Divider
                  left={i - 1}
                  right={i}
                  row={() => row}
                  onLive={setLive}
                />
              </Show>
              <Show
                when={share() > 0}
                fallback={
                  <Rail index={i} pane={pane()} />
                }
              >
                <Column
                  index={i}
                  pane={pane()}
                  grow={share()}
                  derived={props.derived}
                  found={props.found}
                  today={props.today}
                  agenda={props.agenda}
                />
              </Show>
            </>
          )
        }}
      </Index>
    </div>
  )
}

function Column(props: {
  readonly index: number
  readonly pane: Pane
  readonly grow: number
  readonly derived: Derived | undefined
  readonly found: Found
  readonly today: string
  readonly agenda: Agenda | undefined
}) {
  const router = useRouter()
  const focused = () => router.workspace().focus === props.index
  return (
    <div
      class="flex min-h-0 min-w-0 flex-col overflow-y-auto"
      style={{ "flex-grow": String(props.grow), "flex-basis": "0" }}
      classList={{
        "ring-2 ring-inset ring-accent": focused(),
      }}
    >
      <Header index={props.index} pane={props.pane} />
      <PaneProvider index={props.index}>
        <PageView
          derived={props.derived}
          found={props.found}
          today={props.today}
          agenda={props.agenda}
        />
      </PaneProvider>
    </div>
  )
}

function Header(props: { readonly index: number; readonly pane: Pane }) {
  const router = useRouter()
  const focused = () => router.workspace().focus === props.index
  let stop: (() => void) | undefined
  onCleanup(() => stop?.())

  return (
    <div
      class="flex shrink-0 cursor-grab items-center gap-1 border-b border-rule/70 bg-desk px-2 py-1"
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
              ...document.querySelectorAll(`[data-testid="${TESTID.paneHeader}"]`),
            ]
            const over = headers.findIndex((el) => {
              const box = el.getBoundingClientRect()
              return up.clientX >= box.left && up.clientX <= box.right
            })
            if (over >= 0 && over !== from) router.reorder(from, over)
            else if (Math.abs(up.clientX - originX) < 8) router.focus(from)
          },
        })
      }}
    >
      <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted">
        {labelOf(props.pane.route)}
      </span>
      <button
        type="button"
        class={`${TARGET_BOX} inline-flex items-center justify-center rounded text-muted hover:text-ink`}
        data-testid={TESTID.paneClose}
        aria-label={`close ${labelOf(props.pane.route)}`}
        onClick={() => router.close(props.index)}
      >
        <span aria-hidden="true" class="text-base leading-none">×</span>
      </button>
    </div>
  )
}

function Rail(props: { readonly index: number; readonly pane: Pane }) {
  const router = useRouter()
  const focused = () => router.workspace().focus === props.index
  return (
    <button
      type="button"
      class="flex w-9 shrink-0 flex-col items-center gap-2 border-x border-rule/70 bg-desk py-3 text-muted hover:text-ink"
      classList={{ "ring-2 ring-inset ring-accent": focused() }}
      style={{ width: `${PANE_RAIL_PX}px` }}
      data-testid={TESTID.paneRail}
      data-pane={String(props.index)}
      aria-label={`expand ${labelOf(props.pane.route)}`}
      onClick={() => {
        router.expand(props.index)
        router.focus(props.index)
      }}
    >
      <span
        class="origin-center font-mono text-[0.65rem] tracking-wide [writing-mode:vertical-rl] [text-orientation:mixed]"
      >
        {labelOf(props.pane.route)}
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

  const snap = (start: ReadonlyArray<number>, dx: number, width: number): number[] => {
    const frac = width <= 0 ? 0 : dx / width
    const next = [...start]
    const left = Math.max(0, (start[props.left] ?? 0) + frac)
    const right = Math.max(0, (start[props.right] ?? 0) - frac)
    next[props.left] = left
    next[props.right] = right
    const leftPx = left * width
    const rightPx = right * width
    if (leftPx < PANE_MIN_PX && leftPx < rightPx) next[props.left] = 0
    if (rightPx < PANE_MIN_PX && rightPx <= leftPx) next[props.right] = 0
    return next
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="resize panes"
      data-testid={TESTID.paneResize}
      data-left={String(props.left)}
      data-right={String(props.right)}
      class={`group relative ${WITHIN.raised} h-full w-1.5 shrink-0 cursor-col-resize touch-none self-stretch`}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        const row = props.row()
        if (row === undefined) return
        const box = row.getBoundingClientRect()
        const start = flexOf(router.workspace().panes)
        const originX = event.clientX
        event.preventDefault()
        stop?.()
        stop = pointerDrag(event, {
          onMove: (move) => {
            props.onLive(snap(start, move.clientX - originX, box.width))
          },
          onEnd: (up) => {
            stop = undefined
            const last = up === null
              ? snap(start, 0, box.width)
              : snap(start, up.clientX - originX, box.width)
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
  return (
    <div
      class="flex shrink-0 gap-1 overflow-x-auto border-b border-rule/70 bg-desk px-2 py-1"
      data-testid={TESTID.paneTabs}
      role="tablist"
      aria-label="panes"
    >
      <For each={router.workspace().panes}>
        {(pane, i) => {
          const focused = () => router.workspace().focus === i()
          return (
            <button
              type="button"
              role="tab"
              aria-selected={focused()}
              aria-current={focused() ? "page" : undefined}
              class="shrink-0 truncate rounded px-2 py-1 font-mono text-xs text-muted hover:text-ink"
              classList={{
                "bg-panel text-ink ring-1 ring-accent": focused(),
              }}
              data-testid={TESTID.paneTab}
              data-pane={String(i())}
              onClick={() => router.focus(i())}
            >
              {labelOf(pane.route)}
            </button>
          )
        }}
      </For>
    </div>
  )
}
