/** Stable DOM identifiers owned by the tabs row. Names only: a scenario
 *  imports this without pulling a component into a suite with no browser. */
export const TESTID = {
  tabsStrip: "tabs-strip",
  tabsTab: "tabs-tab",
  tabsClose: "tabs-close",
  tabsNew: "tabs-new",
  tabsDot: "tabs-dot",
  tabsAddress: "tabs-address",
  tabsMenu: "tabs-menu",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/tabs": OwnedTestIds }
}
