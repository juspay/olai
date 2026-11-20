import type { Accessor } from "solid-js"

import { serviceTag } from "@olai/plugin-api/contracts"
import type { Workspace } from "olai-plugin-navigation/workspace"

export interface Tab {
  readonly id: string
  readonly href: string
  readonly title: string
  readonly key?: string
}

export interface Mark {
  readonly paint: string
  readonly label: string
  readonly rank: number
}

export interface Dots extends Mark {
  readonly ids: Accessor<ReadonlySet<string>>
}

export interface OpenOptions {
  readonly behind?: boolean
}

export interface TabsState {
  readonly tabs: Accessor<ReadonlyArray<Tab>>
  readonly front: Accessor<string>
  readonly open: (workspace: Workspace, options?: OpenOptions) => string
  readonly show: (id: string) => void
  readonly step: (delta: 1 | -1) => void
  readonly close: (id: string) => void
  readonly closeOthers: (id: string) => void
  readonly duplicate: (id: string) => void
  readonly reorder: (from: number, to: number) => void
  readonly drawn: Accessor<boolean>
  readonly draw: (desktop: Accessor<boolean>) => () => void
  readonly dotted: Accessor<ReadonlyMap<string, Mark>>
  readonly dot: (dots: Dots) => () => void
}

export const tabsState = serviceTag<TabsState>("tabs.state")

