/**
 * OPEN IN NEW TAB, on any link this app can open — a right-click menu over the
 * document's in-app anchors.
 *
 * ONE LISTENER, on the document, for as long as this overlay is mounted — which
 * is as long as the `links` component that contributed it is active. Not one
 * per door: every door is drawn by its own row, and a per-row change would be a
 * change in every row for one gesture this row owns.
 *
 * WHAT IT LEAVES ALONE: a press something else already answered (a row's own
 * long-press menu prevents the event), an anchor inside something that owns a
 * menu of its own (`data-menu-owner`, which the outline's rows wear), the strip
 * itself, a Shift+right-click (the browser's own menu, on request), and any
 * `href` this app's grammar does not read — an external link keeps the
 * browser's menu.
 *
 * Open is the anchor's own click, so whatever that link does on a plain press
 * — navigate its pane, open a saved layout — it does here. Open in new tab puts
 * the page in a tab behind the one in front; below the desktop breakpoint, with
 * no strip to find it in, it comes to the front instead (`tabs.state`'s `open`).
 */
import { createSignal, onCleanup, Show } from "solid-js"

import type { Navigation } from "olai-plugin-navigation/contract"
import { lone, type Workspace } from "olai-plugin-navigation/workspace"

import type { TabsState } from "./contract.ts"
import { PointMenu } from "./chunk.ts"
import { TESTID } from "./testids.ts"

/** The workspace an in-app `href` opens, or `undefined` for one this app would
 *  let the browser have. */
export const workspaceAt = (routes: Navigation["routes"], href: string): Workspace | undefined => {
  const layout = routes.layoutIn(href)
  if (layout !== null) return layout
  const route = routes.routeIn(href)
  return route === null ? undefined : lone(route)
}

export function LinkMenu(props: { readonly tabs: TabsState; readonly router: Navigation }) {
  const [open, setOpen] = createSignal<{
    readonly x: number
    readonly y: number
    readonly anchor: HTMLAnchorElement
    readonly workspace: Workspace
  } | null>(null)

  const onContextMenu = (event: MouseEvent) => {
    if (event.defaultPrevented || event.shiftKey) return
    const target = event.target
    if (!(target instanceof Element)) return
    const anchor = target.closest("a[href]")
    if (!(anchor instanceof HTMLAnchorElement)) return
    if (anchor.closest(`[data-menu-owner], [data-testid="${TESTID.tabsStrip}"]`) !== null) return
    const workspace = workspaceAt(props.router.routes, anchor.getAttribute("href")!)
    if (workspace === undefined) return
    event.preventDefault()
    setOpen({ x: event.clientX, y: event.clientY, anchor, workspace })
  }
  document.addEventListener("contextmenu", onContextMenu)
  onCleanup(() => document.removeEventListener("contextmenu", onContextMenu))

  return (
    <Show when={open()} keyed>{(at) =>
      <PointMenu x={at.x} y={at.y} label="link" close={() => setOpen(null)} entries={[
        { label: "Open", run: () => at.anchor.isConnected ? at.anchor.click() : props.router.open(at.workspace) },
        { label: "Open in new tab", run: () => props.tabs.open(at.workspace, { behind: true }) },
      ]} />
    }</Show>
  )
}
