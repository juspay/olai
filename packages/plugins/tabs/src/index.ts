/** The tabs row's name and its one service. What a tab is, and what the
 *  service offers, is the static contract in `./contract.ts`. */
import { serviceTag } from "@olai/plugin-api/contracts"

import type { TabsState } from "./contract.ts"

export const name = "tabs"

/** The live tab set, offered by the row for its activation. */
export const tabsState = serviceTag<TabsState>("tabs.state")

export type { Dots, OpenOptions, Tab, TabsState } from "./contract.ts"
