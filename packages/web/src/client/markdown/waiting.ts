/**
 * WHAT A SURFACE WEARS while it is holding markdown source it cannot render
 * yet.
 *
 * There is one waiting state in this app and it must look the same wherever it
 * happens — a document body, a `¶` note, the day's note, a preview, a
 * referrer, an agent's reply, a tree row's title, a palette or search row. The
 * LOOK is one rule in ../styles.css, keyed on the attribute below: the source
 * blurred out of legibility and swept, so its box is still the size the real
 * characters make and no reader is shown raw `**` (roadmap
 * `markdown-raw-flash`).
 *
 * This is the other half of that — the MARKUP the rule keys on, which was the
 * one part of "one rule for every surface" that was still spelled once per
 * surface. Three components draw a waiting surface (./Markdown.tsx for every
 * block, ../NodeTitle.tsx and ../search/Result.tsx for the two places a title
 * is drawn as HTML), and a fourth is a matter of time: the attribute is what a
 * scenario grips and what the sheet dresses, so a surface that spelled it
 * differently — or remembered the blur and forgot the `aria-busy` — would be a
 * hole in a promise that reads as though it had no holes.
 *
 * `aria-busy` rides with it because a blur is nothing to a screen reader: the
 * raw source is still in the DOM, and without this it is read out as though it
 * were the text somebody wrote.
 *
 * NOT the failed state, which is a different word on the same attribute
 * (`data-markdown="failed"`, ./Markdown.tsx) and deliberately not dressed:
 * once no renderer is coming, the source IS the answer and has to be legible.
 */

/** The two attributes, for a surface that is waiting or is not. Spread onto
 *  the element that holds the source — the one that carries `innerHTML`, since
 *  the rule blurs what is INSIDE it. */
export const waitingFace = (
  waiting: boolean,
): { readonly "data-markdown"?: "waiting"; readonly "aria-busy"?: "true" } =>
  waiting ? WAITING : NOT_WAITING

/** Two constants rather than a fresh object per call: this is read inside the
 *  memo that draws every row of a tree, and an object literal there is one
 *  allocation per title per frame for a value with two possible answers. */
const WAITING = { "data-markdown": "waiting", "aria-busy": "true" } as const
const NOT_WAITING = {
  "data-markdown": undefined,
  "aria-busy": undefined,
} as const
