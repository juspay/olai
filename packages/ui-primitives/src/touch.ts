export const TARGET = "min-h-11"

export const TARGET_BOX = "min-h-11 min-w-11"

export const GUTTER_GAP = "gap-1"

export const ROW_LINE = `relative flex items-baseline py-[3px] ${GUTTER_GAP}`

export const GLYPH_BOX = "inline-flex items-center"

export const CONTROL =
  "inline-flex h-11 w-7 shrink-0 items-center justify-center md:h-5 md:w-4"

export const HOVER_GUTTER =
  `inline-flex h-11 shrink-0 items-center justify-end ${GUTTER_GAP} md:h-5`

export const HOVER_CELL =
  "inline-flex h-11 w-7 shrink-0 items-center justify-center md:h-5 md:w-4"

/**
 * `hidden` and `inline-flex` are the same property, so which of them wins
 * below md is Tailwind's emission order and not the order they are written in.
 */
export const MENU_CELL =
  "hidden h-11 w-7 shrink-0 items-center justify-center md:inline-flex md:h-5 md:w-4"

/**
 * iOS raises its own callout for a long press and does not send the
 * `contextmenu` that would let it be prevented, so it is turned off wherever
 * this client claims the gesture. (Android's arrives as that event.)
 */
export const HELD = "[-webkit-touch-callout:none]"

/**
 * An arbitrary at-rule variant sorts after `md:` and after `group-hover`
 * (which Tailwind v4 wraps in `@media (hover: hover)` of its own), so an
 * appended clause is the last word wherever it matches.
 */
export const SHOWN_WITHOUT_HOVER = "[@media(hover:none)]:opacity-100"

export const HOVER_REVEAL =
  "opacity-100 md:opacity-0 md:group-hover/row:opacity-100 " +
  "md:group-has-[:focus:not(input):not(textarea)]/row:opacity-100 " +
  SHOWN_WITHOUT_HOVER

export const OFFER_REVEAL =
  "hidden items-center self-center group-data-[active]/row:inline-flex md:inline-flex " +
  "md:opacity-0 md:group-hover/row:opacity-100 " +
  "md:group-has-[:focus:not(input):not(textarea)]/row:opacity-100 " +
  SHOWN_WITHOUT_HOVER

export const MENU_REVEAL =
  "opacity-0 group-hover/row:opacity-100 " +
  "group-has-[:focus:not(input):not(textarea)]/row:opacity-100 " +
  `data-[expanded]:opacity-100 ${SHOWN_WITHOUT_HOVER}`

export const PAST_BULLET = "ml-8 md:ml-5"

export const HANGING_MENU = "contents md:inline-flex md:h-5 md:items-center md:-ml-5"

export const PAST_CONTROLS = "ml-16 md:ml-15"

export const ROW_TITLE = "font-sans text-[0.875rem] leading-[1.5]"

export const SECTION_TITLE =
  "font-sans text-[1rem] font-semibold leading-[1.5] tracking-tight"

export const ROW_NOTE = "text-[0.75rem] leading-normal text-muted"

export const CHILD_INDENT = "ml-3 list-none border-l border-rule/70 pl-3 md:ml-[0.5625rem] md:pl-4"

export const ROOT_RAIL = "-ml-3 pl-3 md:-ml-4 md:pl-4"
