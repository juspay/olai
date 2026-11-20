import { TARGET } from "@olai/ui-primitives/touch.ts"

export const ENTRY_SHAPE =
  `flex min-w-0 ${TARGET} items-center rounded-control px-2 py-1 text-body leading-snug ` +
  "text-ink/85 no-underline hover:bg-ink/5 hover:text-ink aria-[current=page]:bg-ink/8 " +
  "aria-[current=page]:text-ink aria-[current=page]:font-medium md:min-h-7 md:py-0.5"

export const ROW_GAP = "gap-1.5"

export const REGION = "mt-4"

export const REGION_LABEL =
  "m-0 px-2 font-sans text-caption font-semibold uppercase tracking-[0.08em] text-muted"

export const REGION_HEAD = "mb-1 flex min-h-7 items-center justify-between gap-2"

export const HEAD_ACTION =
  "inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-control " +
  "border-0 bg-transparent text-muted hover:bg-ink/5 hover:text-ink " +
  "disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent " +
  "aria-expanded:bg-ink/8 aria-expanded:text-ink md:min-h-6 md:min-w-6"
