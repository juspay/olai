/**
 * THE TABS ROW, when there is one — held by this row's `tabs` component for its
 * activation, so a pinned layout opens as a new tab rather than in place.
 *
 * Optional by construction: the component names `tabs.state` and waits without
 * it, and with nothing held the shelf opens a layout in place, as it did before
 * tabs existed.
 *
 * PRIVATE TO THIS PACKAGE, and it must stay so. The holder is installed by one
 * component and read in another's render, which the `heldService` idiom allows
 * within one package; this row's `"./*"` export would let another package
 * import it too, and that import would be a live value crossing a package wall
 * — which `@olai/bundle`'s fence refuses. Another row wanting tabs names
 * `tabs.state` on a component of its own.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { TabsState } from "olai-plugin-tabs/contract"
import { followLayout } from "olai-plugin-navigation/layout-press"
import type { Router } from "olai-plugin-navigation/routing"
import type { Workspace } from "olai-plugin-navigation/workspace"

const tabs = heldService<Pick<TabsState, "open">>()

/** Told by `../browser.tsx`'s `tabs` component, for that activation. */
export const holdTabs = tabs.hold

/** A press on a pinned layout: `followLayout`'s own gesture rule, answered by
 *  a new tab in front where the tabs row is active, and in place otherwise. */
export const pressLayout = (router: Pick<Router, "open">, workspace: Workspace, event: MouseEvent): void =>
  followLayout(tabs.read() ?? router, workspace, event)
