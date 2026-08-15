/**
 * The two files a person can start from the sidebar, as values: what each door
 * is called, and the names a browser test finds it by.
 *
 * A table rather than props spelled at two call sites, for `../edges/
 * relation.ts`'s reason one directory over: the words are the whole of what
 * differs between the two doors, so they are the thing to keep in one place —
 * and a third kind of file would be a row here rather than a third copy of a
 * path box.
 *
 * The TESTIDS travel with the words rather than being derived from a `kind`,
 * because a `data-testid` is a contract between two packages that never import
 * each other (`../testids.ts`): `new-document` is what the suite has always
 * asked for, and a rename to serve a refactor in this package would be a break
 * in the other one for nothing.
 */

import { type TestId, TESTID } from "../testids.ts"

export interface Making {
  /** The affordance's own words, in the sidebar. */
  readonly label: string
  /** What the empty box suggests — a path, because a file's name IS its
   *  address in this app (the sidebar, the URL and every reading of the set
   *  call it by it), so the honest question asks for exactly that. */
  readonly placeholder: string
  /** What the box is called to a screen reader. */
  readonly aria: string
  readonly testids: {
    readonly open: TestId
    readonly path: TestId
    readonly said: TestId
  }
}

export const MAKING_OUTLINE: Making = {
  label: "+ New outline",
  placeholder: "notes/plan.olai",
  aria: "path of the new outline, relative to the served directory",
  testids: {
    open: TESTID.newOutline,
    path: TESTID.newOutlinePath,
    said: TESTID.newOutlineSaid,
  },
}

export const MAKING_DOCUMENT: Making = {
  label: "+ New document",
  placeholder: "notes/idea.md",
  aria: "path of the new document, relative to the served directory",
  testids: {
    open: TESTID.newDocument,
    path: TESTID.newDocumentPath,
    said: TESTID.newDocumentSaid,
  },
}
