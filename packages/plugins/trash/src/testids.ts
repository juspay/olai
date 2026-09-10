/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it. */
export const TESTID = {
  trashLink: "trash-link",
  trashPage: "trash-page",
  trashGroup: "trash-group",
  trashRow: "trash-row",
  trashPutBack: "trash-put-back",
  trashSaid: "trash-said",
  trashEmpty: "trash-empty",
  trashEmptyVerb: "trash-empty-verb",
  trashEmptyConfirm: "trash-empty-confirm",
  trashEmptyCancel: "trash-empty-cancel",
  trashPageSaid: "trash-page-said",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/trash": OwnedTestIds }
}
