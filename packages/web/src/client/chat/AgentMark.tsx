/**
 * WHICH AGENT, as a mark.
 *
 * A conversation is with one agent, and the header names it beside the model
 * (the human's ruling, 2026-08-21: icon and name). A name alone would be enough
 * to READ and is not enough to GLANCE at, which is the whole reason a mark is
 * asked for: the question "who am I talking to" is one a person answers by
 * looking rather than by reading, several times a session.
 *
 * BUNDLED, AND OURS. Every mark here is drawn in this file as a few SVG shapes
 * — no network, no sprite sheet, no traced logo. Two reasons, and both are
 * load-bearing:
 *
 *   - an artifact fetched from a CDN is a thing a panel can be short of, and a
 *     header that sometimes has no mark is worse than one that never does;
 *   - a mark is a small abstract glyph that says WHICH of the agents on this
 *     machine, in this panel, at 14 pixels. It is not a brand asset and does not
 *     stand in for one.
 *
 * A GENERIC MARK IS THE FALLBACK and it is not a failure: an agent olai has no
 * shape for is drawn as a plain agent and named in full beside it, which is the
 * same bargain every other unknown in this panel gets. What it must never do is
 * borrow another agent's mark — a reader who learns "the burst means Claude"
 * would be told something false the first time a third agent arrived.
 *
 * `currentColor` throughout, so a mark takes the colour of the line it sits on
 * and is legible in both themes without a palette of its own. `data-mark` says
 * which shape was drawn, so a scenario can assert that the generic one turns up
 * exactly where it should rather than reading a path out of the DOM.
 */

import type { JSX } from "solid-js"
import { Dynamic } from "solid-js/web"

import { TESTID } from "../testids.ts"

/** Claude Code: the eight-armed burst. Strokes rather than a filled path, so it
 *  stays open at 14px where a solid mark would read as a blob. */
const ClaudeMark = (): JSX.Element => (
  <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <line x1="8" y1="1.8" x2="8" y2="14.2" />
    <line x1="1.8" y1="8" x2="14.2" y2="8" />
    <line x1="3.6" y1="3.6" x2="12.4" y2="12.4" />
    <line x1="12.4" y1="3.6" x2="3.6" y2="12.4" />
  </g>
)

/** opencode: a terminal's own two shapes, the prompt chevron and the caret
 *  rule — which is what the agent is, and what tells it apart from a burst at a
 *  glance. */
const OpencodeMark = (): JSX.Element => (
  <g
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  >
    <polyline points="3,4 7,8 3,12" />
    <line x1="8.5" y1="12" x2="13" y2="12" />
  </g>
)

/** An agent olai has no shape for: a ring with a dot in it — present, distinct
 *  from both marks above, and claiming nothing about whose it is. */
const GenericMark = (): JSX.Element => (
  <g stroke="currentColor" stroke-width="1.4" fill="none">
    <circle cx="8" cy="8" r="5.6" />
    <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
  </g>
)

/** The marks olai bundles, by the roster's own ids
 *  (`../../../../chat/src/agents/roster.ts`). */
const MARKS: { readonly [id: string]: () => JSX.Element } = {
  claude: ClaudeMark,
  opencode: OpencodeMark,
}

/**
 * The mark for one agent, at the size of the line it sits on.
 *
 * `aria-hidden`, always: the agent's NAME is beside it everywhere this is
 * drawn, so a reader on a screen reader has the whole answer already and a
 * second copy of it would be the header saying the same word twice.
 */
export function AgentMark(props: { readonly id: string }) {
  const known = () => MARKS[props.id]
  return (
    <svg
      viewBox="0 0 16 16"
      class="size-3.5 shrink-0"
      aria-hidden="true"
      data-testid={TESTID.chatAgentMark}
      data-mark={known() === undefined ? "generic" : props.id}
    >
      <Dynamic component={known() ?? GenericMark} />
    </svg>
  )
}
