export const TESTID = {
  section: "plugins-section",
  sectionNew: "plugins-section-new",
  sectionRow: "plugins-section-row",
  sectionEmpty: "plugins-section-empty",
  sectionMark: "plugins-section-mark",

  page: "plugin-page",
  pageMissing: "plugin-page-missing",
  pageState: "plugin-page-state",
  pageVerb: "plugin-page-verb",
  pageMore: "plugin-page-more",
  pageTrustAlways: "plugin-page-trust-always",
  pageTrustStop: "plugin-page-trust-stop",
  pageDelete: "plugin-page-delete",
  pageDeleteConfirm: "plugin-page-delete-confirm",
  pageDeleteKeep: "plugin-page-delete-keep",
  pageAskChange: "plugin-page-ask-change",
  pageAskSaid: "plugin-page-ask-said",
  pageReadAnyway: "plugin-page-read-anyway",
  pageFoot: "plugin-page-foot",
  pageTrustSaid: "plugin-page-trust",
  pageReadme: "plugin-page-readme",
  pageUses: "plugin-page-uses",
  pageAsk: "plugin-page-ask",
  pageCode: "plugin-page-code",
  pageCodeTab: "plugin-page-code-tab",
  pageFolder: "plugin-page-folder",
  pageDiff: "plugin-page-diff",
  pageBanner: "plugin-page-banner",
  pageKnob: "plugin-page-knob",
  pageMoved: "plugin-page-moved",
  pageMovedRead: "plugin-page-moved-read",
  pageRefused: "plugin-page-refused",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/vault-plugins": OwnedTestIds }
}
