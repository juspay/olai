export const TESTID = {
  thumbs: "thumbs",
  appHeader: "app-header",
  appChrome: "app-chrome",
  sidebarToggle: "sidebar-toggle",
  sidebarResize: "sidebar-resize",
  connection: "connection",
  health: "health",
  healthPanel: "health-panel",
  fault: "fault",
  faultDetail: "fault-detail",
  faultHome: "fault-home",
  uptime: "uptime",
  lane: "lane",
  paneRail: "pane-rail",
  paneHeader: "pane-header",
  paneClose: "pane-close",
  paneResize: "pane-resize",
  paneTabs: "pane-tabs",
  paneTab: "pane-tab",
  mainStrip: "main-strip",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/layout": OwnedTestIds }
}
