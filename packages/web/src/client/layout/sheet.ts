/**
 * What a PAGE is: a sheet of paper, filling the space under the bar.
 *
 * The frame is ink — the header and the directory spine are one forest
 * surround (`../styles.css`, `.olai-dir`) — and every screen that is not
 * frame has to paint the paper it sits on, or the outline reads on forest.
 * Nothing can enforce that from above: the paper cannot go on the shell that
 * HOLDS a page, because on desktop that shell is a grid whose first column is
 * the spine, and a paper ground there would put a pale strip under the
 * sidebar wherever the page outgrows the viewport. So it is a rule about
 * every branch of `../App.tsx`'s `Switch`, and this file is where the rule is
 * written down and spelled once.
 *
 * The heights are the other half. One pair of classes, so the grid that HOLDS
 * the panes and the panes themselves cannot disagree about whether a split
 * fills the viewport or a lone page grows with it. The calc is against the
 * header token, not a number (`../styles.css`).
 */

/** A split: fill the remaining viewport so each column can scroll. */
export const SHELL_SPLIT = "h-[calc(100dvh-var(--height-header))] min-h-0"

/** A lone page: grow with the outline, no forced viewport height. */
export const SHELL_LONE = "min-h-[calc(100dvh-var(--height-header))]"

/** A page with no workspace under it — the error page, and the `Reading…`
 *  that stands in for one before the manifest lands. Paper, and as tall as a
 *  lone page: they are the same sheet, and the two of them spelling the calc
 *  by hand is how one of them ends up an inch short of the fold. */
export const SHEET = `bg-paper ${SHELL_LONE}`
