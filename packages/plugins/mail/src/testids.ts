export const TESTID = {
  mailStory: "mail-story",
  mail: "mail",
  mailRow: "mail-row",
  mailAction: "mail-action",
  mailRefused: "mail-refused",
  mailRedirect: "mail-redirect",
} as const

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/mail": OwnedTestIds }
}
