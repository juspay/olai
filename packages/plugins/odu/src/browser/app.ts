import type { JSX } from "solid-js"

export interface OduClocks {
  readonly SECOND: number
  readonly createTicking: (every: number, when?: () => boolean) => () => number
  readonly createNow: (
    started: () => string | number | null | undefined,
  ) => () => number
  readonly wordsOf: (seconds: number) => string
  readonly exactOf: (seconds: number) => string
  readonly tickingOf: (elapsedMs: number) => string
}

export interface BlockChrome {
  readonly Handle: (props: {
    readonly label: string
    readonly onOpen?: () => void
  }) => JSX.Element
  readonly factId: string
  readonly valueId: string
}

export interface PropEntry {
  readonly value: string
}

export interface BlockContext {
  readonly entry: PropEntry
  readonly onOpen?: () => void
  readonly chrome: BlockChrome
}

export interface ChipContext extends BlockContext {
  readonly opened: boolean
  readonly onToggle?: () => void
}
