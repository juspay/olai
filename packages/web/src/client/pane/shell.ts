/**
 * How tall the workspace column is.
 *
 * One pair of classes, so the grid that HOLDS the panes and the panes
 * themselves cannot disagree about whether a split fills the viewport
 * or a lone page grows with it. The calc is against the header token
 * (`../layout/css.ts`), not a number.
 */

/** A split: fill the remaining viewport so each column can scroll. */
export const SHELL_SPLIT = "h-[calc(100dvh-var(--height-header))] min-h-0"

/** A lone page: grow with the outline, no forced viewport height. */
export const SHELL_LONE = "min-h-[calc(100dvh-var(--height-header))]"
