/**
 * The tag completion's list, ASKED — which of the set's tags a prefix means,
 * answered by the server, latest answer wins.
 *
 * ## Why this file exists at all
 *
 * It used to be a walk, and then a read: the tab held every node of every
 * outline, so the vocabulary was the keys of the derivation's own tag index and
 * the widget counted them locally, once per frame. That copy is what
 * `https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/vault-in-browser.md` is taking away — the browser may
 * hold at most the page in front of somebody — so there is no `taggedBy` here
 * to enumerate any more. The counting moved beside the index it reads
 * (`@olai/format`'s `vocabulary.ts`, which carries the argument for every rule
 * in it), and what is left on this side is when to ask.
 *
 * The file it replaces spent two paragraphs arguing that this list, unlike the
 * node search next door, was NOT the server's — "the enumeration is already in
 * the value this tab is holding". The argument was sound and its premise is
 * gone. What it also predicted is what happened: "if a tag facet ever becomes a
 * REPORT — every tag, most used first, across a corpus this tab does not hold —
 * that is a reading, it belongs on both faces, and this file becomes its
 * caller."
 *
 * ## A SHORTLIST, so the asking is `../settled.ts`'s and not the filter's
 *
 * The settle, the latest-answer-wins rule and the failure slot are the
 * primitive's — this door was the third to want them, which is what moved them
 * out of `../search/nodes.ts` into a file of their own. What is left here is
 * the two things that are this widget's: WHICH question is worth asking, and
 * what the rows mean.
 *
 * The page filter (`../filter/asking.ts`) is not that primitive's caller and
 * says why: it is a STANDING VIEW that re-asks on every published revision,
 * where a shortlist under a caret is a question somebody opened, answered once
 * and closed by choosing a row or typing past it. So nothing here carries the
 * set's generation and nothing re-asks on a revision — exactly like the `((`
 * search this widget's third trigger already calls.
 *
 * NO MINIMUM LENGTH, which is where it parts from the node search: a bare `#`
 * is a question with an answer — "what does this set even use" — where two
 * characters of a node query match half an outline. The whole (capped) list is
 * what an empty prefix means, and it always was.
 *
 * ## What a dead wire does
 *
 * Nothing special, deliberately. A refused call is a refusal in its own words,
 * drawn on the popup where the `((` search's already is (`./Completions.tsx`),
 * and a dead socket is not this door's question at all: the app freezes under
 * an overlay while the wire cannot carry one (`../connection/Offline.tsx`,
 * §5b's ruling), so nothing is typed at this popup and no keystroke of it ever
 * meets a dead wire. The filter's inert box was the other answer to that, and
 * the overlay deleted it.
 */

import type { Accessor } from "solid-js"

import type { TagCompletion, TagsRequest } from "@olai/surface"

import { createSettled, type Taking } from "../settled.ts"
import { olai } from "../wire.ts"

/** How many rows the widget offers. A row's popup is a shortlist — and the
 *  number travels ON THE REQUEST rather than living in the answer's shape,
 *  because a row count is a fact about a door (`@olai/format`'s `TagsRequest`
 *  argues it where the field is declared).
 *
 *  NOT `../search/nodes.ts`'s eight, which is a different fact that happens to
 *  have the same value: that one is how many NODES a search door shows, and it
 *  is exported because the composer budgets its file rows against it. Two doors
 *  agreeing on a number are not one number, and importing it here would make a
 *  change to the palette's shortlist silently a change to this popup. */
const LIMIT = 8

/**
 * What one asking is about: which namespace, and what has been typed after the
 * sigil.
 *
 * ONE VALUE rather than two accessors, because the two halves of a trigger are
 * one thing (`./trigger.ts` produces them together) and splitting them here
 * would let a frame carry `@`'s namespace with `#`'s prefix.
 *
 * ...and the REQUEST minus the cap, rather than a second declaration of two of
 * its three fields: the question a widget asks per keystroke and the question
 * that goes on the wire differ by exactly one number, and that number is this
 * door's own constant rather than something the caret decides. Spelled as its
 * own struct, a field added to `TagsRequest` would be a field this shape
 * silently did not have.
 */
export type Asking = Omit<TagsRequest, "limit">

export interface Tags {
  readonly rows: Accessor<ReadonlyArray<TagCompletion>>
  /** A refusal from the server, in its own words — `null` when there is none.
   *  Never silently dropped (`../run.ts` forbids a silent handler). */
  readonly failure: Accessor<string | null>
  /** HOW A KEY SPENDS A ROW of these — `../settled.ts`'s `Taking`, straight
   *  through, and the whole of what this door needs to know about staleness:
   *  the rows hold still through a settle and a flight, and a widget that takes
   *  one on `Enter` has to be able to tell "these are yours" from "these are
   *  the last prefix's". It is the ACT rather than the label, because a label
   *  a caller must remember to consult is a label a caller forgets — the
   *  `answering` accessor this replaced had exactly one reader and the two
   *  doors beside it had none. */
  readonly taking: Taking
}

/** BY VALUE, because the trigger is a fresh object per keystroke and most
 *  keystrokes in a line are not about the tag in it: moving the caret along
 *  `#home`, or typing anywhere else in the title, is the same sigil and the
 *  same prefix in a new object, and identity would make each of those a round
 *  trip for an answer already on screen. */
const same = (was: Asking | null, is: Asking | null): boolean =>
  was === is ||
  (was !== null && is !== null && was.sigil === is.sigil && was.query === is.query)

/**
 * Ask as the trigger changes. `null` is "no tag is being typed" — the popup is
 * shut, or the caret moved off it — and answers with no rows rather than with
 * the list from before.
 */
export const createTags = (asking: Accessor<Asking | null>): Tags => {
  const asked = createSettled(
    asking,
    (one) => olai.procedures.vocabulary.tags({ ...one, limit: LIMIT }),
    same,
  )
  return {
    rows: () => asked.answer()?.tags ?? [],
    failure: asked.failure,
    taking: asked.taking,
  }
}
