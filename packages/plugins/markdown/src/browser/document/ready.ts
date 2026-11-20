import type { DocumentEntry } from "../../wire.ts"

export type Served = Extract<DocumentEntry, { readonly state: "served" }>
export type Refused = Extract<DocumentEntry, { readonly state: "refused" }>

export const isServed = (entry: DocumentEntry | undefined): entry is Served =>
  entry?.state === "served"
