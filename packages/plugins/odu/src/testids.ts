export const TESTID = {
  ciChip: "ci-chip",
  odu: "odu",
  ciMatrix: "ci-matrix",
  ciCell: "ci-cell",
} as const

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/odu": OwnedTestIds }
}
