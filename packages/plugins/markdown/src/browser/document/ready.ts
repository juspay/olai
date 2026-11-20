import type { DocumentEntry } from "../../wire.ts"

export type Served = DocumentEntry & {
  readonly text: string
  readonly refused: false
}

export type Refused = DocumentEntry & { readonly refused: true }

export type Ready = Served | Refused

export const isServed = (entry: DocumentEntry | undefined): entry is Served =>
  entry !== undefined && entry.refused === false && entry.text !== null
