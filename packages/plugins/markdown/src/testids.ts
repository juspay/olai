/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it. */
export const TESTID = {
  documentNudge: "document-nudge",
  documentLink: "document-link",

  documentPage: "document-page",
  bodyRefused: "body-refused",
  documentReferrers: "document-referrers",
  documentReferrersSummary: "document-referrers-summary",
  documentReferrer: "document-referrer",
  documentSeeRefs: "document-see-refs",
  documentMentionRefs: "document-mention-refs",
  documentLinkRefs: "document-link-refs",
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
