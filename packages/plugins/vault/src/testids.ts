/** This plugin adds no browser elements. */
export const TESTID = {  errorView: "error-view",
  errorFileGroup: "error-file-group",
  error: "error",
  crossFileErrors: "cross-file-errors",
  stageNote: "stage-note",
  staleBanner: "stale-banner",
  brokenFileLine: "broken-file-line",
  brokenFileLink: "broken-file-link",
  brokenFileMore: "broken-file-more",
  outlineFailure: "outline-failure",
} as const

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/vault": OwnedTestIds }
}
