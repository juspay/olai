/** Link menus read the same anchor href as navigation and hover preview.
 * The overlay owns this document listener. Row menus yield only their links;
 * Shift-right-click and the tab strip retain their own handling. */
import { createSignal, onCleanup, Show } from "solid-js"



import type { Navigation } from "olai-plugin-navigation/contract"
import { lone, type Workspace } from "olai-plugin-navigation/workspace"

import type { TabsState } from "./contract.ts"
import { PointMenu } from "./chunk.ts"
import { TESTID } from "./testids.ts"

/** The workspace an in-app `href` opens, or `undefined` for one this app would
 *  let the browser have. */
export const workspaceAt = (routes: Navigation["routes"], href: string): Workspace | undefined => {
  const route = routes.routeIn(href)
  return route === null ? undefined : route.kind === "layout" ? route.workspace : lone(route)
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
    if (anchor.closest(`[data-testid="${TESTID.tabsStrip}"]`) !== null) return
    const workspace = workspaceAt(props.router.routes, anchor.href)
    if (workspace === undefined) return
    event.preventDefault()
    setOpen({ x: event.clientX, y: event.clientY, anchor, workspace })
  }
  document.addEventListener("contextmenu", onContextMenu)
  onCleanup(() => document.removeEventListener("contextmenu", onContextMenu))

  return (
    <Show when={open()} keyed>{(at) =>
      <PointMenu x={at.x} y={at.y} label="Link menu" close={() => setOpen(null)} entries={[
        { label: "Open", run: () => at.anchor.isConnected ? at.anchor.click() : props.router.open(at.workspace) },
        { label: "Open in new tab", run: () => props.tabs.open(at.workspace, { behind: true }) },
      ]} />
    }</Show>
  )
}
