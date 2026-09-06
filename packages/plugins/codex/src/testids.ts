/** Engine faces live inside core-owned elements, so this plugin mints no test id. */
export const TESTID = {} as const

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/codex": OwnedTestIds }
}
