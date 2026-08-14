/**
 * A `#tag` in a title, pressed.
 *
 * Workflowy's gesture, and the one it was always going to be: clicking a tag
 * filters the page to what carries it, ancestors kept
 * (docs/brainstorming/viewing-web.md — "tag click lands with search, not
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

import { ours } from "../press.ts"

/** The attribute the pill publishes. A `data-` fact rather than a class, the
 *  same treatment every other machine-read fact on a row gets. */
export const TAG_ATTRIBUTE = "data-tag"

/** The tag a click landed on, or `null` for a click that landed anywhere else.
 *
 *  Which presses are this app's at all is `../press.ts`'s one answer, not a
 *  third spelling of it: a modified click is the browser's (⌘-click and
 *  shift-click on a row are also the multi-select gestures, `../Tree.tsx`), and
 *  one something deeper already answered — a tag inside a breadcrumb, where the
 *  `<Link>` has run first — goes where the link says. */
export const taggedBy = (event: MouseEvent): string | null => {
  if (!ours(event)) return null
  const target = event.target
  if (!(target instanceof Element)) return null
  // `closest`, because a pill can hold an element the markdown put there.
  return target.closest(`[${TAG_ATTRIBUTE}]`)?.getAttribute(TAG_ATTRIBUTE) ?? null
}

/** Is this click on a tag pill? What a row's own title handler asks before it
 *  opens an editor, so one press does not both filter the page and put a caret
 *  in the line — the press belongs to the tag. */
export const onATag = (event: MouseEvent): boolean => taggedBy(event) !== null
