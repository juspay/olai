export const sheetHeight = (fills: {
  readonly underStrip: boolean
  readonly split: boolean
}): string =>
  fills.split
    ? fills.underStrip
      ? "h-[calc(100dvh-var(--height-header)-var(--height-strip,0px))] min-h-0"
      : "h-[calc(100dvh-var(--height-header))] min-h-0"
    : fills.underStrip
      ? "min-h-[calc(100dvh-var(--height-header)-var(--height-strip,0px))]"
      : "min-h-[calc(100dvh-var(--height-header))]"

export const SHEET = `bg-paper ${sheetHeight({ underStrip: false, split: false })}`
