export type Tone = "healthy" | "quiet" | "notice" | "alarm"

export const TONE: Readonly<Record<Tone, { readonly dot: string; readonly text: string }>> = {
  healthy: { dot: "bg-done", text: "" },
  quiet: { dot: "", text: "" },
  notice: { dot: "bg-doing", text: "text-doing" },
  alarm: { dot: "bg-alarm", text: "text-alarm" },
}

export interface Look {
  readonly tone: Tone
  readonly label: string
  readonly detail: string
}

import { LAYER } from "./layer.ts"

export const PILL =
  "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-body " +
  "text-ink/80 enabled:hover:bg-pill/60 enabled:cursor-pointer " +
  "min-h-11 md:min-h-0"

export const STATUS_ROW = PILL

export const DOT = "inline-block size-2 shrink-0 rounded-full"

export const ICON_BUTTON =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-control " +
  "border-0 bg-transparent px-2 text-label text-muted hover:bg-ink/5 hover:text-ink " +
  "aria-expanded:bg-ink/8 aria-expanded:text-ink " +
  "min-h-11 md:min-h-0 md:h-7 md:min-w-7 md:px-1.5"

export const BANNER =
  "flex min-h-11 w-full items-center gap-2 border-b border-rule bg-paper " +
  "px-4 py-2.5 text-left text-body"

export const PANEL_BOX = `fixed ${LAYER.over} ` +
  "flex min-h-0 flex-col overflow-y-auto overflow-x-hidden overscroll-contain " +
  "rounded-surface border border-rule bg-panel p-4 text-body shadow-overlay focus:outline-none"
