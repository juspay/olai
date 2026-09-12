/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it. */
export const TESTID = {
  fileLink: "file-link",
  railOutlines: "rail-outlines",
  railDocs: "rail-docs",
  sidebarFiles: "sidebar-files",
  outlineList: "outline-list",
  fileDir: "file-dir",
  fileDirToggle: "file-dir-toggle",
  fileGlyph: "file-glyph",
  newDocument: "new-document",
  newDocumentPath: "new-document-path",
  newDocumentSaid: "new-document-said",
  newOutline: "new-outline",
  newOutlinePath: "new-outline-path",
  newOutlineSaid: "new-outline-said",
  vaultLink: "vault-link",
  vaultGroup: "vault-group",
  fileDeleteVerb: "file-delete-verb",
  fileDeleteConfirm: "file-delete-confirm",
  fileDeleteCancel: "file-delete-cancel",
  fileDeleteSaid: "file-delete-said",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/files": OwnedTestIds }
}
