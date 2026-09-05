/**
 * Tag completions subscribe to the current vocabulary while a trigger is open.
 * Queries debounce; vault revisions refresh their rows without another key.
 * Answers retain their query and sigil so Enter cannot spend an older prefix,
 * and switching namespaces cannot offer a hash tag as an at-tag.
 */

import { type Accessor, createEffect, createMemo, createSignal } from "solid-js"
import { debounce } from "@solid-primitives/scheduled"

import type { TagCompletion, TagsAnswer, TagsRequest } from "@olai/surface"

import { SETTLE_MS, type Taking } from "../settled.ts"
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
  const wanted = createMemo(asking, null, { equals: same })
  const [asked, setAsked] = createSignal<Asking | null>(null, { equals: same })
  const settle = debounce(setAsked, SETTLE_MS)
  createEffect(() => {
    const query = wanted()
    if (query !== null) settle(query)
    else {
      settle.clear()
      setAsked(null)
    }
  })
  const input = createMemo(() => {
    const query = asked()
    return query === null ? null : { ...query, limit: LIMIT }
  })
  const answer = olai.streams.tagCompletions.use(input)
  const held = createMemo<{ query: Asking; value: TagsAnswer } | undefined>((previous) => {
    const query = asked()
    const current = wanted()
    if (current === null || query === null || answer.error() !== undefined) return undefined
    // Prefixes may retain earlier rows while waiting; namespaces may not.
    if (query.sigil !== current.sigil) return undefined
    const value = answer()
    if (value !== undefined) return { query, value }
    return previous?.query.sigil === query.sigil ? previous : undefined
  }, undefined)
  return {
    rows: () => held()?.value.tags ?? [],
    failure: () => answer.error()?.message ?? null,
    taking: (act) => {
      const got = held()
      if (got !== undefined && same(got.query, wanted())) act()
    },
  }
}
