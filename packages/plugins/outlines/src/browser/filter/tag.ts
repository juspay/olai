/**
 * A `#tag` in a title, pressed.
 *
 * Workflowy's gesture, and the one it was always going to be: clicking a tag
 * filters the page to what carries it, ancestors kept
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/viewing-web.md — "tag click lands with search, not
 * navigation"). Tags have been decorative since title-markdown precisely
 * because promising this before the filter machinery existed would have been a
 * pill that did nothing.
 *
 * It is a DELEGATED listener rather than a handler on the pill because the pill
 * is not a component: a title reaches the page as HTML through `innerHTML`
 * (`../markdown/tags.ts` writes it, `../NodeTitle.tsx` hands it over), so its
 * spans belong to nobody. That is the same situation, and so the same answer,
 * as a link inside rendered markdown — one listener on the main pane
 * (`../router.tsx`'s `followed` says why the PANE and not the document).
 *
 * The tag AS WRITTEN is what the filter gets, sigil and all: `#alice` and
 * `@alice` are two tags, and a filter of the bare name would quietly widen the
 * press into both namespaces plus every ordinary word that spells it.
 */

import { ours } from "@olai/web/client/press.ts"

/** The attribute the pill publishes. A `data-` fact rather than a class, the
 *  same treatment every other machine-read fact on a row gets. */
export { TAG_ATTRIBUTE } from "@olai/markdown-ui/tag-contract.ts"
import { TAG_ATTRIBUTE } from "@olai/markdown-ui/tag-contract.ts"

/** The tag a click landed on, or `null` for a click that landed anywhere else.
 *
 *  Which presses are this app's at all is `../press.ts`'s one answer, not a
 *  third spelling of it: a modified click is the browser's (⌘-click and
 *  shift-click on a row are also the multi-select gestures, `../Tree.tsx`), and
 *  one something deeper already answered — a tag inside a breadcrumb, or
 *  inside a row that is itself one link to somewhere (`NodeTitle`, the
 *  shared `ReferrersSection`), where the surrounding anchor has run first —
 *  goes where the link says.
 *
 *  NAMED FOR THE PRESS, and it was `taggedBy` until `@olai/format` grew a
 *  `Derived.taggedBy` — the reverse index of which records write which tag.
 *  Two unrelated answers under one word in one app is a grep that lands on the
 *  wrong file; this one is about a MouseEvent and says so. */
export const tagPressed = (event: MouseEvent): string | null => {
  if (!ours(event)) return null
  const target = event.target
  if (!(target instanceof Element)) return null
  // `closest`, because a pill can hold an element the markdown put there.
  const held = target.closest(`[${TAG_ATTRIBUTE}]`)
  if (held === null) return null
  // A tag inside an ANCHOR is not a filter affordance — the row's whole claim
  // is one link, and the pill sits inside it only because a title travels
  // whole (`NodeTitle`, the shared `ReferrersSection`). The link has run
  // first, as with a breadcrumb; the tag keeps its look, and the press goes
  // where the row points. A tag with no anchor around it (a tree row, a
  // zoomed heading) still filters.
  if (held.closest("a") !== null) return null
  return held.getAttribute(TAG_ATTRIBUTE)
}

/** Is this click on a tag pill? What a row's own title handler asks before it
 *  opens an editor, so one press does not both filter the page and put a caret
 *  in the line — the press belongs to the tag. */
export const onATag = (event: MouseEvent): boolean => tagPressed(event) !== null
