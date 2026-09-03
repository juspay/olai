/**
 * PI'S MARK — the letter the agent is named for, drawn as its three strokes
 * rather than set in a typeface.
 *
 * ## Why it is in this package
 *
 * It was a `MARKS` record inside `@olai/web`, keyed by engine id, with the three
 * engines' shapes next to each other in one core file. That table cannot exist
 * any more and should not: `packages/bundle/src/fence.test.ts` holds as an
 * equality per package that no general package spells a plugin's name in code,
 * and an ENGINE is a plugin now. The rule is the right one rather than an
 * obstacle — what a tenant looks like is a decision made where somebody knows
 * what the tenant IS — and it is the same move kolu's and odu's marks already
 * made.
 *
 * ## What core keeps, and what it may not
 *
 * The ELEMENT is core's — the sixteen-unit box, the size, `aria-hidden`, the
 * `data-mark` attribute — because those are facts about the COLUMN a mark is
 * read in rather than about the engine (`@olai/web`'s `chat/AgentMark.tsx`).
 * What arrives from here is a `<g>` and nothing else. And it must never borrow
 * another engine's shape: a reader who learns "the burst means Claude" would be
 * told something false the first time it turned up on somebody else's row.
 *
 * BUNDLED AND OURS: a few SVG shapes in this file, no network and no traced
 * logo. `currentColor` throughout, so it takes the colour of the line it sits on
 * and is legible in both themes without a palette of its own.
 */

import type { JSX } from "solid-js"

export const PiMark = (): JSX.Element => (
  <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none">
    <path d="M 4.4 3.5 h 8 a 2.3 3.4 0 0 0 -2.3 3.4 v 5.6" />
    <line x1="7.2" y1="3.5" x2="7.2" y2="12.5" />
  </g>
)
