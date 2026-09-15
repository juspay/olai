/**
 * THE TABS ROW'S STATIC CONTRACT — what a tab is, and what another row may do
 * to the set of them. Types and one constant; no state, no runtime.
 *
 * The live value is `tabs.state` (`./index.ts`'s `tabsState`), offered by the
 * row for its activation.
 */
import type { Accessor } from "solid-js"

import { serviceTag } from "@olai/plugin-api/contracts"
import type { Workspace } from "olai-plugin-navigation/workspace"

/**
 * ONE TAB: an address, what it was called the last time it was in front, and
 * the name of the history entry it was left on.
 *
 * An ADDRESS rather than a workspace, because a route is a reading of the
 * mounted roster: a tab brought forward is parsed again, so a plugin that
 * arrived or left since the tab was opened is honoured. A tab's address may
 * hold a whole split.
 */
export interface Tab {
  readonly id: string
  readonly href: string
  /** A snapshot: a tab in the background has no page mounted to ask. */
  readonly title: string
  /** The history entry the tab was left on, so its scroll comes back with it. */
  readonly key?: string
}

export interface OpenOptions {
  /** Keep the tab in front where it is. Ignored below the desktop breakpoint,
   *  where there is no strip to find the new tab in. */
  readonly behind?: boolean
}

export interface TabsState {
  /** The tabs, in strip order. */
  readonly tabs: Accessor<ReadonlyArray<Tab>>
  /** The id of the tab in front — the one the router is drawing. */
  readonly front: Accessor<string>
  /** Open `workspace` in a new tab after the one in front; answers its id. */
  readonly open: (workspace: Workspace, options?: OpenOptions) => string
  /** Bring a tab to the front. Not a history event. */
  readonly show: (id: string) => void
  /** Bring the next (`1`) or previous (`-1`) tab to the front, wrapping. */
  readonly step: (delta: 1 | -1) => void
  /** Take a tab away, and its history with it. The last tab leaves a
   *  front-page tab behind. */
  readonly close: (id: string) => void
  readonly closeOthers: (id: string) => void
  /** A copy placed right after the tab, brought to the front. */
  readonly duplicate: (id: string) => void
  readonly reorder: (from: number, to: number) => void
  /**
   * Whether a strip is drawing the tabs on a desktop right now. Below the
   * breakpoint, or with no strip, the set is kept but not driven: `open` always
   * brings the new tab forward and the chords do nothing.
   */
  readonly drawn: Accessor<boolean>
  /** The strip saying it draws the tabs, and at which breakpoint; the answer is
   *  its release. */
  readonly draw: (desktop: Accessor<boolean>) => () => void
  /** The tabs wearing a dot, by id, with the dot's paint (utility classes). */
  readonly dotted: Accessor<ReadonlyMap<string, string>>
  /** A reading of which tabs wear a dot and how it is painted, from whoever
   *  knows; the answer is its release. */
  readonly dot: (dots: Dots) => () => void
}

export interface Dots {
  readonly ids: Accessor<ReadonlySet<string>>
  readonly paint: string
}

/** The live tab set, offered by the row for its activation. */
export const tabsState = serviceTag<TabsState>("tabs.state")

/** The preference the set is kept under, per browser. */
export const TABS_KEY = "olai.tabs"

/** The stored shape's version. A record of any other is read as no record. */
export const STORED_VERSION = 1

export interface Stored {
  readonly v: typeof STORED_VERSION
  readonly front: string
  /** The front tab is kept as its id and entry key alone. */
  readonly tabs: ReadonlyArray<Tab | Pick<Tab, "id" | "key">>
}
