/**
 * The tag completion's list, ASKED — which of the set's tags a prefix means,
 * answered by the server, latest answer wins.
 *
 * ## Why this file exists at all
 *
 * It used to be a walk, and then a read: the tab held every node of every
 * outline, so the vocabulary was the keys of the derivation's own tag index and
 * the widget counted them locally, once per frame. That copy is what
 * `docs/brainstorming/vault-in-browser.md` is taking away — the browser may
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
 * ## A SHORTLIST, so it is `../search/nodes.ts`'s shape and not the filter's
 *
 * There are two askers in this client already and they differ in exactly one
 * way, which is the way that decides which one this is. The page filter
 * (`../filter/asking.ts`) is a STANDING VIEW: it re-asks on every published
 * revision, because a row retitled into the query has to appear. A shortlist
 * under a caret is not that — it is a question somebody opened, answered once,
 * and closed by choosing a row or typing past it — so this carries no generation
 * and no revision re-ask, exactly like the `((` search this widget's third
 * trigger already calls. Two askers, not three.
 *
 * What it takes from both is the pair of disciplines a round trip per keystroke
 * costs, and neither is restated here because both are argued there:
 *
 *   - {@link SETTLE_MS} is the debounce, IMPORTED rather than picked — one fact
 *     about one pair of hands, and this popup and the box in the header are the
 *     same hands.
 *   - `createResource` drops the answer to a source that has since moved, so
 *     the ROWS cannot be stale; the failure slot is a signal every question
 *     shares and gets the guard the framework only gives to the answer.
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
 * and the ruling for the app as a whole is an overlay that freezes it on a dead
 * socket (`vault-in-browser.md` §5b, its own PR). The filter's inert-box
 * treatment is not copied here for the reason above: a filter left a PAGE
 * standing that had to say what it was showing, and a completion that cannot be
 * answered simply has nothing to offer.
 */

import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"
import {
  type Accessor,
  createEffect,
  createResource,
  createSignal,
  untrack,
} from "solid-js"

import type { TagCompletion, TagsRequest } from "@olai/surface"

import { runAsync } from "../run.ts"
import { SETTLE_MS } from "../search/nodes.ts"
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

/** What one asking is about: which namespace, and what has been typed after the
 *  sigil. The two halves of a trigger, and the whole of the question — the
 *  cap is this file's. */
export interface Asking {
  readonly sigil: TagsRequest["sigil"]
  readonly query: string
}

export interface Tags {
  readonly rows: Accessor<ReadonlyArray<TagCompletion>>
  /** A refusal from the server, in its own words — `null` when there is none.
   *  Never silently dropped (`../run.ts` forbids a silent handler). */
  readonly failure: Accessor<string | null>
}

const same = (was: Asking | null, is: Asking | null): boolean =>
  was === is ||
  (was !== null && is !== null && was.sigil === is.sigil && was.query === is.query)

/**
 * Ask as the trigger changes. `null` is "no tag is being typed" — the popup is
 * shut, or the caret moved off it — and answers with no rows rather than with
 * the list from before.
 *
 * IT TAKES THE TRIGGER, not two accessors: the sigil and the prefix are one
 * value in the widget that produces them (`./trigger.ts`), and splitting them
 * here would let a frame carry `@`'s namespace with `#`'s prefix.
 */
export const createTags = (asking: Accessor<Asking | null>): Tags => {
  const [failure, setFailure] = createSignal<string | null>(null)
  /** What has actually been asked for: the trigger, once it stopped moving.
   *
   *  COMPARED BY VALUE, because the trigger is a fresh object per keystroke and
   *  most keystrokes in a line are not about the tag in it: moving the caret
   *  along `#home`, or typing anywhere else in the title, hands this the same
   *  sigil and the same prefix in a new object. Without `equals` each of those
   *  would be a round trip for an answer already on screen. */
  const [asked, setAsked] = createSignal<Asking | null>(null, { equals: same })
  const settle = debounce(setAsked, SETTLE_MS)

  createEffect(() => {
    const wanted = asking()
    if (wanted !== null) {
      settle(wanted)
      return
    }
    // Clearing takes effect AT ONCE rather than after the settle: a list left
    // standing under a caret that has moved off the tag is a list that is lying
    // for as long as it stands — and the keys it claims while it stands are the
    // row editor's (`./completing.tsx`'s `showing`).
    settle.clear()
    setAsked(null)
    setFailure(null)
  })

  /** Is this fetcher still answering the question that is being asked? The
   *  answer is the framework's to drop; the failure slot is shared by every
   *  question and is not, so a slow refusal of one prefix must not land under
   *  the next one's rows. `untrack`, because this is read inside an async
   *  continuation: as a dependency it would make a fetcher's own resolution a
   *  reason to re-run it. */
  const answering = (ask: Asking) => same(untrack(asked), ask)

  const [answer] = createResource(asked, async (ask: Asking) => {
    const outcome = await runAsync(
      olai.procedures.vocabulary.tags({
        sigil: ask.sigil,
        query: ask.query,
        limit: LIMIT,
      }),
    )
    if (Result.isFailure(outcome)) {
      if (answering(ask)) setFailure(outcome.failure.message)
      return null
    }
    if (answering(ask)) setFailure(null)
    return outcome.success
  })

  // `undefined` is the resource's "nothing asked for yet"; a popup shows no
  // rows in that state, which is the same thing an empty answer shows.
  return { rows: () => answer()?.tags ?? [], failure }
}
