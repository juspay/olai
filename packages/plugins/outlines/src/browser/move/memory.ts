/** A prepared move belongs to its page, not to one render of the picker. */
import { createSignal } from "solid-js"
import type { Standing } from "./gesture.ts"

export const moveMemory = () => ({
  standing: createSignal<Standing | null>(null),
  query: createSignal(""),
  sending: createSignal(false),
  judging: createSignal<ReadonlyArray<string> | null>(null),
})
