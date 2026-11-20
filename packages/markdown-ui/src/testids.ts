export const TESTID = {
  tag: "tag",
  hit: "hit",
  undrawnPicture: "undrawn-picture",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "markdown-ui": OwnedTestIds }
}
