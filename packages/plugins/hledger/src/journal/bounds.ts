export const HLEDGER_LINES = 20_000

export const HLEDGER_TRANSACTIONS = 1_000

export const HLEDGER_CELL = 2_000

export interface Bounds {
  readonly lines: number
  readonly transactions: number
  readonly cell: number
}

export const boundedBy = (asked?: Partial<Bounds>): Bounds => ({
  lines: asked?.lines ?? HLEDGER_LINES,
  transactions: asked?.transactions ?? HLEDGER_TRANSACTIONS,
  cell: asked?.cell ?? HLEDGER_CELL,
})

export interface Clipped {
  readonly text: string
  readonly cut: boolean
}

export const clip = (text: string, at: number): Clipped =>
  text.length <= at ? { text, cut: false } : { text: text.slice(0, at), cut: true }

export const accountKeyAfterCut = (clipped: string): string => {
  const key = clipped.replace(/:+$/, "")
  return key === "" ? clipped : key
}
