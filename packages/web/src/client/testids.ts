export const TESTID = {
  offline: "offline",
  reload: "reload",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "web": OwnedTestIds }
}

export { selector, type AnyTestId } from "@olai/ui-primitives/testids.ts"
