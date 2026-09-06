/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it. */
export const TESTID = {
  appHeader: "app-header",
  appChrome: "app-chrome",
  sidebarToggle: "sidebar-toggle",
  sidebarResize: "sidebar-resize",
  connection: "connection",
  fault: "fault",
  faultDetail: "fault-detail",
  faultHome: "fault-home",
  uptime: "uptime",
  panelResize: "panel-resize",
  paneRail: "pane-rail",
  paneHeader: "pane-header",
  paneClose: "pane-close",
  paneResize: "pane-resize",
  paneTabs: "pane-tabs",
  paneTab: "pane-tab",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/layout": OwnedTestIds }
}
