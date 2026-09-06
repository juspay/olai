/**
 * Whether a document entry is one a writer or a renderer can open.
 *
 * A refusal is not a body. Folding `refused` into `text ?? ""` is how a `doc`
 * line went blank for a file that had something to say.
 */

import type { DocumentEntry } from "@olai/surface"

export type Served = DocumentEntry & {
  readonly text: string
  readonly refused: false
}

export type Refused = DocumentEntry & { readonly refused: true }

export type Ready = Served | Refused

export const isServed = (entry: DocumentEntry | undefined): entry is Served =>
  entry !== undefined && entry.refused === false && entry.text !== null
