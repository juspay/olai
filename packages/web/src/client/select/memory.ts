/** Keep a page's picked rows across a rebuild, without retaining its readers. */
import { createSignal } from "solid-js"
import type { Said } from "../saying.ts"
import { serial } from "../edit/queue.ts"

export const selectionMemory = () => ({
  keys: createSignal<ReadonlySet<string>>(new Set()),
  said: createSignal<Said | null>(null),
  anchor: createSignal<string | null>(null),
  focus: createSignal<string | null>(null),
  /** Position in the ⌘A ladder; other selection gestures reset it. */
  widened: 0,
  enqueue: serial(),
})
