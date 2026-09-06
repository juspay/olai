/** A prepared move belongs to its page, not to one render of the picker. */
import { createSignal } from "solid-js"
import type { Standing } from "./moving.tsx"

export const moveMemory = () => ({
  standing: createSignal<Standing | null>(null),
  query: createSignal(""),
  sending: createSignal(false),
})
