import { createSignal } from "solid-js"
import type { Said } from "@olai/web/client/saying.ts"
import { serial } from "../edit/queue.ts"

export const selectionMemory = () => ({
  keys: createSignal<ReadonlySet<string>>(new Set()),
  said: createSignal<Said | null>(null),
  anchor: createSignal<string | null>(null),
  focus: createSignal<string | null>(null),
  widened: 0,
  enqueue: serial(),
})
