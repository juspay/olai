// ONE CELL for both dots, so the three sizes cannot come to disagree about
// where the middle is: move the gutter and the line, the dots and the indent
// move with it.
// Literal class names, never computed ones — Tailwind scans this file as text.

export const SPINE_INDENT = "pl-10"

export const SPINE_CELL = "flex w-10 shrink-0 items-center justify-center"

export const SPINE_LINE = "absolute left-[calc(1.25rem-1px)] top-0 bottom-0 w-0.5"

export const SPINE_DOT = "size-[7px] shrink-0 rounded-full"

export const SPINE_NOW = "size-[11px] shrink-0 rounded-full"

export const QUIET_INDENT = "pl-9"
