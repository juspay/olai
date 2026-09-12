/** Stable identifiers owned by this row's browser contributions. */
export const TESTID = {
  imageLink: "image-link",
  imageView: "image-view",
} as const
export type TestId = (typeof TESTID)[keyof typeof TESTID]
import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/image": OwnedTestIds }
}
