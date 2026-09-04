/**
 * WHICH AGENT, as a mark.
 *
 * A conversation is with one agent, and the header names it beside the model
 * (the human's ruling, 2026-08-21: icon and name). A name alone would be enough
 * to READ and is not enough to GLANCE at, which is the whole reason a mark is
 * asked for: the question "who am I talking to" is one a person answers by
 * looking rather than by reading, several times a session.
 *
 * ## The shapes are the ENGINE'S now, and that is the phase
 *
 * There was a `MARKS` record in this file — a `<g>` per engine, keyed by the
 * roster's own ids, with the three of them next to each other. That table cannot
 * exist any more and should not: an engine is a PLUGIN, and
 * `packages/bundle/src/fence.test.ts` holds as an equality per package that no
 * general package spells a plugin's name in code. The rule is the right one
 * rather than an obstacle — what a tenant looks like is a decision made where
 * somebody knows what the tenant IS — so each engine hangs its own shape in the
 * `delivery.mark` slot from its own browser half, and this component draws
 * whatever came back.
 *
 * IT IS THE SAME LOOKUP {@link ./PluginMark.tsx} MAKES, and by the same key: an
 * engine's id IS its plugin's word, so the string the panel already has for "who
 * is this conversation with" is the string the slot table is keyed by. The two
 * components stay separate because their GENERICS differ and must — see below.
 *
 * ## What core keeps
 *
 * The ELEMENT: the sixteen-unit box, the size, `aria-hidden`, and `data-mark`.
 * Those are facts about the COLUMN a mark is read in rather than about the
 * agent, and a plugin that could pick its own size could make its row look
 * unlike every row around it.
 *
 * `currentColor` throughout, so a mark takes the colour of the line it sits on
 * and is legible in both themes without a palette of its own. `data-mark` says
 * which shape was drawn, so a scenario can assert that the generic one turns up
 * exactly where it should rather than reading a path out of the DOM.
 *
 * ## The generic is core's, and is not a failure
 *
 * An agent this tab has no shape for — an engine whose browser chunk the roster
 * did not name, or an id no plugin in this build answers to — is drawn as a
 * plain agent and named in full beside it, which is the same bargain every other
 * unknown in this panel gets. What it must never do is BORROW ANOTHER AGENT'S
 * MARK: a reader who learns "the burst means Claude" would be told something
 * false the first time a fourth engine arrived. It is deliberately not the
 * plugin generic either — a ring with a dot rather than a plug on a frame —
 * because "an agent, and this panel has not been told which" and "a plugin, and
 * this panel has not been told which" are two different sentences.
 */

import type { JSX } from "solid-js"
import { Dynamic } from "solid-js/web"

import { markOf } from "../marks.ts"
import { TESTID } from "../../testids.ts"

/** An agent olai has no shape for: a ring with a dot in it — present, distinct
 *  from every engine's own mark, and claiming nothing about whose it is. */
const GenericMark = (): JSX.Element => (
  <g stroke="currentColor" stroke-width="1.4" fill="none">
    <circle cx="8" cy="8" r="5.6" />
    <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
  </g>
)

/**
 * HOW BIG A MARK IS in this panel, wherever it is drawn and whoever it is of.
 *
 * One constant because the marks are now read as a COLUMN — the person, the
 * agent, a plugin, one under another down a transcript ({@link ./Speaker.tsx})
 * — and a column whose glyphs are two sizes reads as two kinds of thing. It
 * began as this file's own class list, which was fine while an agent's was the
 * only mark there was; a second and a third copy of `size-3.5` is how one of
 * them ends up a pixel out with nothing to catch it.
 *
 * `shrink-0` is part of the answer rather than a caller's decoration: every
 * line a mark sits on has a truncating name beside it, and a mark that gave way
 * to a long one would be a face squashed to nothing exactly where the name is
 * least readable.
 */
export const MARK = "size-3.5 shrink-0"

/**
 * The mark for one agent, at the size of the line it sits on.
 *
 * `aria-hidden`, always: the agent's NAME is beside it everywhere this is
 * drawn, so a reader on a screen reader has the whole answer already and a
 * second copy of it would be the header saying the same word twice.
 */
export function AgentMark(props: { readonly id: string }) {
  const known = () => markOf(props.id)
  return (
    <svg
      viewBox="0 0 16 16"
      class={MARK}
      aria-hidden="true"
      data-testid={TESTID.chatAgentMark}
      data-mark={known() === undefined ? "generic" : props.id}
    >
      <Dynamic component={known() ?? GenericMark} />
    </svg>
  )
}
