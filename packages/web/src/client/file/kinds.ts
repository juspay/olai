/**
 * What the DIRECTORY COLUMN does with each kind of served file: where a row of
 * it goes when it is clicked, and what a scenario calls that row.
 *
 * The format's registry (`@olai/format`'s `kinds.ts`) says which kinds exist
 * and what each is called on disk; it cannot say where one goes, because a
 * route is this client's own vocabulary and the format cannot import it. So
 * that half lives here, in the layer that owns the question.
 *
 * The two halves are shaped differently ON PURPOSE, and the difference is the
 * point. Where a row goes is DERIVED — a file whose content is a body opens the
 * page that draws a body, and an outline opens the tree — so a fourth kind gets
 * its address from the same rule the other three follow, and cannot be given a
 * wrong one by hand. What a test GRIPS it by cannot be derived: it is a name,
 * and a name is a decision. That one is a `Record` over the registry's union,
 * so a kind added there is a compile error here and nowhere else.
 *
 * A first draft had both in one table, with a `route` per kind spelling
 * `{ kind: "document" }` twice. That is the registry's `holds` column written
 * out a second time in the client — the same "two answers to one question" this
 * whole seam exists against, and it would have compiled just as happily with
 * the wrong one.
 */

import { type FileKind, holdsText } from "@olai/format"

import type { Route } from "../routes.ts"
import { TESTID } from "../testids.ts"

/**
 * The page a file of this kind opens.
 *
 * A `.olai` is a tree with rows to zoom into and a filter to narrow by;
 * everything else is a body drawn for reading. Which of the two a kind gets is
 * `holds` and nothing else — see `../routes.ts` for why the suffix already in
 * the path, rather than a prefix in front of it, is what tells the kinds apart.
 */
export const routeTo = (of: FileKind, file: string): Route =>
  holdsText(of) ? { kind: "document", file } : { kind: "outline", file }

/** What a scenario grips a row of this kind by. Per kind rather than shared,
 *  because a step that says "the documents listed are …" is asking about ONE
 *  kind, and a shared id would make that step quietly true of a directory
 *  holding something else. */
export const ROW_TESTID: Record<FileKind, string> = {
  outline: TESTID.outlineLink,
  document: TESTID.documentLink,
  hypertext: TESTID.hypertextLink,
}
