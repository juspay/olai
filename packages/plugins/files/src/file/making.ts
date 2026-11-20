import type { Claim } from "@olai/format"
import type { AnyTestId as TestId } from "@olai/ui-primitives/testids.ts"
import { TESTID } from "olai-plugin-files/testids"
export interface Making {
  readonly of: Claim["kind"]
  readonly label: string
  readonly placeholder: string
  readonly aria: string
  readonly testids: {
    readonly open: TestId
    readonly path: TestId
    readonly said: TestId
  }
}

export const MAKING_OUTLINE = (of: Claim["kind"]): Making => ({
  of,
  label: "New outline",
  placeholder: "notes/plan",
  aria:
    "Name of the new outline, like notes/plan",
  testids: {
    open: TESTID.newOutline,
    path: TESTID.newOutlinePath,
    said: TESTID.newOutlineSaid,
  },
})

export const MAKING_DOCUMENT = (of: Claim["kind"]): Making => ({
  of,
  label: "New document",
  placeholder: "notes/idea",
  aria:
    "Name of the new document, like notes/idea",
  testids: {
    open: TESTID.newDocument,
    path: TESTID.newDocumentPath,
    said: TESTID.newDocumentSaid,
  },
})
