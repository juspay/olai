/**
 * KOLU'S FACE — the mark over a sentence kolu put into somebody's conversation.
 *
 * The doorbell writes into a person's chat lane (`@olai/plugins`' `Deliveries`),
 * and the panel draws such a row as a speaker in its own right — a third one,
 * beside the person and the agent. Every speaker there is named by a mark, and
 * this file is where kolu's comes from, because core is not allowed to know it:
 * `@olai/plugins`' `fence.test.ts` holds "no general package spells a plugin's
 * name" as an equality per package, so a `MARKS = { kolu: … }` in the panel is
 * red on the day it is written rather than a shortcut somebody tidies later.
 *
 * ## Why a mark at all, when the row already carries a byline
 *
 * The byline is kolu's own OPENING SENTENCE, lifted out of the delivered body
 * (`@olai/web`'s `chat/byline.ts`) — prose, authored per delivery, and the only
 * attribution that survives a replay. A mark is the other half of that: the
 * question "who is talking" is one a reader answers by LOOKING, several times a
 * conversation, and a line of mono prose is not something anybody looks at. The
 * two say the same thing at two speeds, which is what a transcript wants.
 *
 * ## Two overlapping panes, and why not a bell
 *
 * kolu is a FLEET of terminals — several panes, one of which is in front — and
 * that is what the shape says: two rounded frames, offset, with a prompt
 * chevron in the near one. A bell would name the DOORBELL, which is one thing
 * kolu does through one door; a mark that named the door rather than the
 * appliance would be wrong on the day kolu delivers anything else, and it would
 * be wrong immediately beside the terminal rows this same plugin draws in the
 * property drawer (`./mount.tsx`).
 *
 * DRAWN HERE, in a few SVG shapes, with no network and no sprite sheet — the
 * bargain `@olai/web`'s `chat/AgentMark.tsx` argues for the agents' marks, kept
 * word for word: a face fetched from a CDN is a face a panel can be short of,
 * and a transcript that sometimes has no mark is worse than one that never
 * does. It is a small abstract glyph saying WHICH tenant, at fourteen pixels,
 * and it does not stand in for a brand asset.
 *
 * `currentColor` throughout, so the mark takes the colour of the line it sits
 * on and is legible in every theme without a palette of its own. The `viewBox`
 * and the size are the panel's, put on by whoever draws it, for the reason the
 * manifest's `PluginMark` takes no argument.
 */

import type { JSX } from "solid-js"

export const KoluMark = (): JSX.Element => (
  <g
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  >
    {/* The pane BEHIND, drawn as three sides: the fourth is under the near one,
        and a full rectangle there reads as a grid rather than as a stack. */}
    <path d="M 5.2 2.4 h 8 v 8" />
    {/* ... and the one in front, whole, with a prompt in it. */}
    <rect x="1.8" y="5.4" width="8.4" height="8.2" rx="1.4" />
    <polyline points="3.9,8.2 5.6,9.6 3.9,11" />
  </g>
)
