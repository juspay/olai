import { createSignal } from "solid-js"
import type { Relation } from "./relation.ts"

/** Prepared edge edits retain their relation and search on the same page. */
export const edgeMemory = () => ({
  open: createSignal<Relation | null>(null),
  query: createSignal(""),
  sending: createSignal(false),
})
