/**
 * CLAUDE CODE'S MARK — the eight-armed burst, drawn where a reader glances
 * rather than reads.
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
 * read in rather than about the engine (`@olai/web`'s `chat/AgentMark.tsx`). A
 * plugin that could pick its own size could make its row look unlike every row
 * around it, which is a request the panel refuses. What arrives from here is a
 * `<g>` and nothing else.
 *
 * ## The drawing itself
 *
 * BUNDLED AND OURS: a few SVG shapes in this file, no network, no sprite sheet,
 * no traced logo. An artifact fetched from a CDN is a thing a panel can be short
 * of, and a header that sometimes has no mark is worse than one that never does;
 * and a mark is a small abstract glyph that says WHICH agent at fourteen pixels,
 * not a brand asset standing in for one.
 *
 * STROKES rather than a filled path, so it stays open at 14px where a solid mark
 * would read as a blob. `currentColor` throughout, so it takes the colour of the
 * line it sits on and is legible in both themes without a palette of its own.
 */

import type { JSX } from "solid-js"

export const ClaudeMark = (): JSX.Element => (
  <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <line x1="8" y1="1.8" x2="8" y2="14.2" />
    <line x1="1.8" y1="8" x2="14.2" y2="8" />
    <line x1="3.6" y1="3.6" x2="12.4" y2="12.4" />
    <line x1="12.4" y1="3.6" x2="3.6" y2="12.4" />
  </g>
)
