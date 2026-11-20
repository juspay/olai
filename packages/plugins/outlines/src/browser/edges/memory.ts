import { createSignal } from "solid-js"
import type { Relation } from "./relation.ts"
export const edgeMemory = () => ({
  open: createSignal<Relation | null>(null),
  query: createSignal(""),
  sending: createSignal(false),
})
