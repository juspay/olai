/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it. */
export const TESTID = {
  documentLink: "document-link",

  documentPage: "document-page",
  docLink: "doc-link",
  docRef: "doc-ref",
  bodyRefused: "body-refused",
  documentReferrers: "document-referrers",
  documentReferrersSummary: "document-referrers-summary",
  documentReferrer: "document-referrer",
  documentBody: "document-body",
  documentEdit: "document-edit",
  documentEditor: "document-editor",
  documentSave: "document-save",
  documentCancel: "document-cancel",
  documentSaid: "document-said",
  documentOverwrite: "document-overwrite",
  documentDrifted: "document-drifted",
  toc: "toc",
  tocLink: "toc-link",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/markdown": OwnedTestIds }
}
