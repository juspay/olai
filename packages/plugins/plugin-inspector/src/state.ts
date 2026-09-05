import { createSignal } from "solid-js"
import type { HeldOpen } from "@olai/web/client/popover.ts"

/** Approval history belongs to this inspector activation, independently of
 * its rendered door. An unrelated provider or shell replacement must not
 * silently approve a source version the reader has not acknowledged. */
export const createInspectorState = () => {
  const [open, setOpen] = createSignal(false)
  const [read, setRead] = createSignal<ReadonlyMap<string, string>>(new Map())
  let active = true
  const door: HeldOpen = { open, setOpen }
  return {
    door, read,
    nowRead: (name: string, version: string) => {
      if (!active) throw new Error("The inspector activation has closed")
      setRead((was) => new Map(was).set(name, version))
    },
    close: () => { active = false; setOpen(false); setRead(new Map()) },
  }
}
export type InspectorState = ReturnType<typeof createInspectorState>
