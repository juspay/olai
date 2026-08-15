/**
 * What the DIRECTORY COLUMN does with each kind of served file: where a row of
 * it links, and what a test calls that row.
 *
 * The format's registry (`@olai/format`'s `kinds.ts`) says which kinds exist
 * and what each is called on disk; it cannot say where one goes when it is
 * clicked, because a route is this client's own vocabulary and the format
 * cannot import it. So the two halves are one table each, in the layer that
 * owns the question — and this one is a `Record` over the registry's union, so
 * a kind added there is a compile error HERE, naming the one decision a new
 * kind of file cannot inherit.
 *
 * It is a table rather than the pair of ternaries it replaces (`route`,
 * `testid`, each asking `of === "outline"` on its own) for the reason
 * `./icons.tsx` gives beside its glyphs: two conditions answering about one
 * thing are two answers that agree by hand, and the third kind is where they
 * stop agreeing.
 */

import { type FileKind } from "@olai/format"

import type { Route } from "../routes.ts"
import { TESTID } from "../testids.ts"

interface Drawn {
  /** The page this kind of file opens. A `.olai` is a tree with rows to zoom
   *  and filter; everything else is a body drawn for reading, and `/doc/` is
   *  the one address for that (../routes.ts says why the suffix, not a third
   *  prefix, is what distinguishes them). */
  readonly route: (file: string) => Route
  /** What a scenario grips this row by. Per kind rather than shared, because a
   *  step that says "the documents listed are …" is asking about ONE kind, and
   *  a shared id would make that step quietly true of a directory holding
   *  something else. */
  readonly testid: string
}

export const DRAWN: Record<FileKind, Drawn> = {
  outline: {
    route: (file) => ({ kind: "outline", file }),
    testid: TESTID.outlineLink,
  },
  document: {
    route: (file) => ({ kind: "document", file }),
    testid: TESTID.documentLink,
  },
}
