export const TESTID = {
  inboxLink: "inbox-link",
  inboxHeld: "inbox-held",
  inboxCount: "inbox-count",
  paletteCapture: "palette-capture",
  thumbCapture: "thumb-capture",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/capture": OwnedTestIds }
}
