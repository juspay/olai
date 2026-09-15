/**
 * THE STRIP — the row of tabs above the panes, on a desktop.
 *
 * Desk ground and a one-pixel rule under it; the tab in front on paper with the
 * rule broken under it, the others muted. A press brings a tab forward when it
 * is let go, a drag reorders it with the
 * pane header's threshold and pointer helper, a middle-click closes it, and a
 * right-click opens its menu. `+` opens a front-page tab, and the readout at
 * the right is the address of the tab in front.
 *
 * It draws the list and nothing else: every verb is `tabs.state`'s.
 */
import { Key } from "@solid-primitives/keyed"
import { createEffect, createSignal, Show } from "solid-js"

import { DOT } from "@olai/web/client/readout.ts"
import { drag } from "@olai/web/client/pointer.ts"
import type { Navigation } from "olai-plugin-navigation/contract"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { lone } from "olai-plugin-navigation/workspace"

import type { Tab, TabsState } from "./contract.ts"
import { glyphOf } from "./face.ts"
import { PointMenu } from "./Menu.tsx"
import { TESTID } from "./testids.ts"

/** How far a press on a tab travels before it is a drag — the pane header's. */
const DRAG_PX = 8

export function Strip(props: { readonly tabs: TabsState; readonly router: Navigation }) {
  const tabs = props.tabs
  const [menu, setMenu] = createSignal<{ readonly id: string; readonly x: number; readonly y: number } | null>(null)
  const [lifted, setLifted] = createSignal<string | null>(null)
  let row: HTMLDivElement | undefined
  let stop: (() => void) | undefined

  const frontHref = () => tabs.tabs().find((tab) => tab.id === tabs.front())?.href ?? ""

  // The tab in front is kept in view when it changes — a chord or a new tab
  // can bring one forward that the strip has scrolled past.
  createEffect(() => {
    const id = tabs.front()
    queueMicrotask(() => row?.querySelector(`[data-tab-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" }))
  })

  // A PRESS THAT DOES NOT TRAVEL brings the tab forward when it is let go, not
  // when it goes down: the page coming back asks for its old scroll position,
  // and that request stands down for the reader's own pointerdown — which the
  // one still being dispatched would be.
  const press = (event: PointerEvent, tab: Tab) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest("button")) return
    const from = tabs.tabs().findIndex((one) => one.id === tab.id)
    let moved = false
    stop?.()
    stop = drag(event, {
      threshold: DRAG_PX,
      onStart: () => {
        moved = true
        setLifted(tab.id)
      },
      onEnd: (up) => {
        stop = undefined
        setLifted(null)
        if (up === null) return
        if (!moved) return tabs.show(tab.id)
        if (row === undefined) return
        const faces = [...row.querySelectorAll(`[data-testid="${TESTID.tabsTab}"]`)]
        const over = faces.findIndex((face) => {
          const box = face.getBoundingClientRect()
          return up.clientX >= box.left && up.clientX <= box.right
        })
        const to = over >= 0 ? over : up.clientX < (faces[0]?.getBoundingClientRect().left ?? 0) ? 0 : faces.length - 1
        if (to !== from) tabs.reorder(from, to)
      },
    })
  }

  return (
    <div data-testid={TESTID.tabsStrip} class="relative flex h-full items-end gap-1 bg-desk px-2 pt-1.5">
      <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-rule/70" />
      <div ref={row} role="tablist" aria-label="open tabs"
        class="flex h-full min-w-0 flex-1 items-end gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
        <Key each={tabs.tabs()} by="id">{(tab, index) => {
          const front = () => tabs.front() === tab().id
          const dot = () => tabs.dotted().get(tab().id)
          return (
            <div
              role="tab"
              aria-selected={front()}
              tabIndex={front() ? 0 : -1}
              title={tab().title}
              data-testid={TESTID.tabsTab}
              data-tab={String(index())}
              data-tab-id={tab().id}
              data-tab-front={front() ? "true" : undefined}
              data-href={tab().href}
              data-lifted={lifted() === tab().id ? "true" : undefined}
              // EVERY TAB THE SAME WIDTH, up to a cap: a title that changes
              // (a page naming itself as it arrives) must not move its
              // neighbours along the strip.
              class="group/tab relative flex min-w-[5rem] max-w-[15rem] flex-1 basis-0 cursor-default select-none items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 pl-2.5 pr-1 text-[0.8125rem]"
              classList={{
                "z-[1] h-full border-rule/70 bg-paper font-semibold text-ink": front(),
                "h-[calc(100%-0.25rem)] border-transparent text-muted hover:bg-panel/55 hover:text-ink": !front(),
                "opacity-40": lifted() === tab().id,
              }}
              draggable={false}
              onPointerDown={(event) => press(event, tab())}
              onMouseDown={(event) => { if (event.button === 1) event.preventDefault() }}
              onAuxClick={(event) => {
                if (event.button !== 1) return
                event.preventDefault()
                tabs.close(tab().id)
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                setMenu({ id: tab().id, x: event.clientX, y: event.clientY })
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault()
                  tabs.step(event.key === "ArrowRight" ? 1 : -1)
                }
              }}
            >
              <span aria-hidden="true" class="shrink-0 font-mono text-xs opacity-75">{glyphOf(props.router.routes, tab().href)}</span>
              <span class="min-w-0 truncate">{tab().title}</span>
              <Show when={dot()}>{(paint) =>
                <span data-testid={TESTID.tabsDot} data-tab-dot="true" role="img" aria-label="needs you" class={`${DOT} ${paint()}`} />
              }</Show>
              <button
                type="button"
                data-testid={TESTID.tabsClose}
                aria-label={`close ${tab().title}`}
                class="flex size-5 shrink-0 items-center justify-center rounded font-mono text-sm leading-none text-muted hover:bg-rule hover:text-ink focus-visible:opacity-100 group-hover/tab:opacity-100"
                classList={{ "opacity-0": !front() }}
                onClick={(event) => {
                  event.stopPropagation()
                  tabs.close(tab().id)
                }}
              >×</button>
            </div>
          )
        }}</Key>
      </div>
      <button
        type="button"
        data-testid={TESTID.tabsNew}
        aria-label="new tab"
        title="new tab"
        class="mb-1.5 flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-muted hover:bg-panel hover:text-ink"
        onClick={() => tabs.open(lone(HOME_ROUTE))}
      >+</button>
      <span data-testid={TESTID.tabsAddress} class="mb-2.5 ml-2 max-w-[18rem] shrink-0 truncate font-mono text-[0.7rem] text-muted">
        {frontHref()}
      </span>
      <Show when={menu()} keyed>{(open) =>
        <PointMenu x={open.x} y={open.y} label="tab" close={() => setMenu(null)} entries={[
          { label: "Duplicate tab", run: () => tabs.duplicate(open.id) },
          { label: "Close other tabs", run: () => tabs.closeOthers(open.id) },
          { rule: true },
          { label: "Close", run: () => tabs.close(open.id) },
        ]} />
      }</Show>
    </div>
  )
}
