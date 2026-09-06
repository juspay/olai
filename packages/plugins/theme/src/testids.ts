/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it. */
export const TESTID = {
  themeChip: "theme-chip",
  fontSelect: "font-select",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/theme": OwnedTestIds }
}
