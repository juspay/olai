/**
 * THE TABS ROW, when there is one — held by this row's `tabs` component for its
 * activation, so a pinned layout opens as a new tab rather than in place.
 *
 * Optional by construction: the component names `tabs.state` and waits without
 * it, and with nothing held the shelf opens a layout in place, as it did before
 * tabs existed.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { TabsState } from "olai-plugin-tabs/contract"
import { followLayout } from "olai-plugin-navigation/layout-press"
import type { Router } from "olai-plugin-navigation/routing"
import { savedLayout, type Workspace } from "olai-plugin-navigation/workspace"

const tabs = heldService<Pick<TabsState, "open">>()

/** Told by `../browser.tsx`'s `tabs` component, for that activation. */
export const holdTabs = tabs.hold

/** A press on a pinned layout: a new tab in front where the tabs row is active,
 *  else in place. A press that asks the browser for a tab of its own, or that
 *  something already answered, is left to it either way. */
export const pressLayout = (router: Pick<Router, "open">, workspace: Workspace, event: MouseEvent): void => {
  const held = tabs.read()
  if (held === undefined) return followLayout(router, workspace, event)
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.button !== 0) return
  event.preventDefault()
  held.open(savedLayout(workspace))
}
