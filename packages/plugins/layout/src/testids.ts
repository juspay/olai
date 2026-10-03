/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it. */
export const TESTID = {
  appHeader: "app-header",
  appChrome: "app-chrome",
  sidebarToggle: "sidebar-toggle",
  sidebarResize: "sidebar-resize",
  connection: "connection",
  /** The bar's one health dot (desktop). `data-health` is `healthy` / `notice` /
   *  `alarm` — the state, never the colour. */
  health: "health",
  /** ...and the popover it opens: one row per status readout, the uptime
   *  line, and the plugins door at its foot. */
  healthPanel: "health-panel",
  fault: "fault",
  faultDetail: "fault-detail",
  faultHome: "fault-home",
  uptime: "uptime",
  panelResize: "panel-resize",
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
