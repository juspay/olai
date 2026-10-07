/** The browser pane's own DOM names, on a door of their own so a scenario can
 *  assert on them without pulling a component into a suite with no browser. */
export const TESTID = {
  browserHeader: "browser-header",
  browserPage: "browser-page",
  browserStanding: "browser-standing",
  browserStart: "browser-start",
  browserTab: "browser-tab",
  browserTabClose: "browser-tab-close",
  browserNewTab: "browser-new-tab",
  browserAddress: "browser-address",
  browserViewer: "browser-viewer",
  browserFrame: "browser-frame",
  browserForget: "browser-forget",
  browserForgetConfirm: "browser-forget-confirm",
  browserSaid: "browser-said",
  browserEntry: "browser-entry",
  railBrowser: "rail-browser",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/browsing": OwnedTestIds }
}
