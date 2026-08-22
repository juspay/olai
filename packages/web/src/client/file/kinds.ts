/**
 * What the DIRECTORY COLUMN does with each kind of served file: where a row of
 * it goes when it is clicked, and what a scenario calls that row.
 *
 * The format's registry (`@olai/format`'s `kinds.ts`) says which kinds exist
 * and what each is called on disk; it cannot say where one goes, because a
 * route is this client's own vocabulary and the format cannot import it. So
 * that half lives here, in the layer that owns the question.
 *
 * WHERE A ROW GOES IS NOT HERE ANY MORE, and its leaving is worth recording:
 * this file held a `routeTo(kind, file)` that answered "a body opens the page
 * that draws a body, an outline opens the tree". Since the route's content arms
 * collapsed onto one address (`../routes.ts`), a file's route is its ADDRESS
 * and nothing else — `atFile` — and which page that address opens is asked once
 * where the page is picked (`../page.ts`). A derivation that was right is still
 * a second place holding the answer, and the whole point of the collapse is
 * that there is one.
 *
 * What is left is what could never be derived: what a test GRIPS a row by. That
 * is a name, and a name is a decision — so it is a `Record` over the registry's
 * union, and a kind added there is a compile error here.
 */

import type { FileKind } from "@olai/format"

import { TESTID } from "../testids.ts"

/** What a scenario grips a row of this kind by. Per kind rather than shared,
 *  because a step that says "the documents listed are …" is asking about ONE
 *  kind, and a shared id would make that step quietly true of a directory
 *  holding something else. */
export const ROW_TESTID: Record<FileKind, string> = {
  outline: TESTID.outlineLink,
  document: TESTID.documentLink,
  hypertext: TESTID.hypertextLink,
}

/**
 * What ONE FILE of this kind is called in a sentence a person reads — with its
 * article, because the sentence that spends it puts two of these side by side
 * ("`notes.md` is a document, not an outline") and an article added by the
 * caller would be the caller holding a fact about a word it was handed.
 *
 * Here for {@link ROW_TESTID}'s reason exactly: a name is a decision, the
 * registry cannot make it (what a kind is CALLED to a reader is this client's
 * vocabulary — the sidebar's doors say these words), and a `Record` over the
 * union means a fourth kind is a compile error here rather than a sentence
 * about `undefined`.
 *
 * HYPERTEXT CARRIES NO ARTICLE, and that is the word rather than an omission:
 * "a hypertext" is not English, and this kind is the one with no door of its
 * own — olai shows a `.html` and never writes one — so it is only ever met as
 * the left-hand half of that sentence.
 */
export const KIND_NAMED: Record<FileKind, string> = {
  outline: "an outline",
  document: "a document",
  hypertext: "hypertext",
}
