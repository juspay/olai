import type { JSX } from "solid-js"

export interface BlockEntry {
  readonly key: string
  readonly value: string
}

export interface BlockChrome {
  readonly Handle: (props: {
    readonly label: string
    readonly onOpen?: () => void
  }) => JSX.Element
  readonly factId: string
  readonly valueId: string
}

export interface BlockContext {
  readonly entry: BlockEntry
  readonly onOpen?: () => void
  readonly chrome: BlockChrome
}
