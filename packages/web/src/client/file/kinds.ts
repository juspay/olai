/**
 * What THIS CLIENT knows about a kind of served file that the format cannot
 * say: what a scenario calls a row of one, and what a reader calls one out
 * loud.
 *
 * The format's registry (`@olai/format`'s `kinds.ts`) says which kinds exist
 * and what each is called on disk; it cannot say what a SCENARIO grips one by
 * or what a READER is told one is, because both are this client's own
 * vocabulary and the format cannot import it. So those live here, in the layer
 * that owns the question.
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
 * What is left is what could never be derived: what a test GRIPS a row by, and
 * what a PERSON calls the thing. Both are names, and a name is a decision — so
 * each is a `Record` over the registry's union, and a kind added there is a
 * compile error here.
 */

import type { FileKind } from "@olai/format"

import { type TestId, TESTID } from "../testids.ts"

/** What a scenario grips a row of this kind by. Per kind rather than shared,
 *  because a step that says "the documents listed are …" is asking about ONE
 *  kind, and a shared id would make that step quietly true of a directory
 *  holding something else. */
export const ROW_TESTID: Record<FileKind, TestId> = {
  outline: TESTID.outlineLink,
  document: TESTID.documentLink,
  hypertext: TESTID.hypertextLink,
  csv: TESTID.csvLink,
  image: TESTID.imageLink,
  pdf: TESTID.pdfLink,
}

/**
 * WHAT A READER CALLS EACH KIND, in a sentence — the vocabulary seam, and the
 * whole of it.
 *
 * The registry names kinds for the code that branches on them; this is the same
 * set of things said the way somebody looking at their own directory would say
 * them, which is why `hypertext` is a "page" here and nowhere else in the
 * source. A kind added to the registry owes a WORD here — chosen for a reader
 * rather than inherited from it — and the compile error is what asks for it.
 *
 * THREE OF THE SIX ARE THE REGISTRY'S OWN WORD, and that is not laziness: a
 * person looking at their folder says "the csv", "the pdf" and "the image", so
 * the reader's word and the code's word genuinely coincide there. `image`
 * rather than "picture" is the one to argue: "picture" is what markdown's rule
 * calls the subset it may point at (`@olai/format`'s `isPicture`), and a
 * refusal telling somebody their `.svg` "is a picture" while that rule says it
 * is not would be this app using one word for two sets.
 *
 * IT MOVED HERE from `../Nothing.tsx`, which is where it was written and whose
 * docstring already promised this: "if a second surface ever has to say a kind
 * out loud, it reads this rather than minting a second noun". The second
 * surface arrived — `./completing.ts`'s refusal names two kinds in one breath
 * — and a rule module importing a COMPONENT to borrow three words would have
 * been the reason the promise got broken instead of kept. So the table sits
 * beside the client's other per-kind name ({@link ROW_TESTID}) and both
 * surfaces read it.
 *
 * THE ARTICLE IS A FIELD rather than a letter somebody looks at, because "a" or
 * "an" is a fact about a WORD and not a rule about its spelling (an hour, a
 * unicorn) — and because only one of the two moods wants it: "No outline named
 * that" takes the bare noun, "is a document, not an outline" takes both.
 */
interface Named {
  /** The noun on its own — what a sentence that already has an article, or
   *  wants none, spends. */
  readonly noun: string
  /** The indefinite article that noun takes. */
  readonly article: string
}

export const NAMED: Record<FileKind, Named> = {
  outline: { noun: "outline", article: "an" },
  document: { noun: "document", article: "a" },
  hypertext: { noun: "page", article: "a" },
  csv: { noun: "csv", article: "a" },
  image: { noun: "image", article: "an" },
  pdf: { noun: "pdf", article: "a" },
}

/** ONE of them — "an outline", "a page". Beside the table rather than in the
 *  sentence that spends it twice (`./completing.ts`'s refusal names two kinds
 *  in one breath), so how the two fields go together is written down once. */
export const oneNamed = (kind: FileKind): string =>
  `${NAMED[kind].article} ${NAMED[kind].noun}`
