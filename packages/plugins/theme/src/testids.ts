export const TESTID = {
  themeChip: "theme-chip",
  themeFollow: "theme-follow",
  fontSelect: "font-select",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/theme": OwnedTestIds }
}
