/** Stable identifiers owned by this row's browser contributions. */
export const TESTID = {
  hypertextLink: "hypertext-link",
  hypertextPreview: "hypertext-preview",
  hypertextSaid: "hypertext-said",
} as const
export type TestId = (typeof TESTID)[keyof typeof TESTID]
import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/hypertext": OwnedTestIds }
}
