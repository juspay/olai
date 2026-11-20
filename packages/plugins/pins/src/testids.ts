export const TESTID = {
  pinShelf: "pin-shelf",
  pin: "pin",
  pinLink: "pin-link",
  pinRemove: "pin-remove",
  pinRename: "pin-rename",
  pinDropLine: "pin-drop-line",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/pins": OwnedTestIds }
}
