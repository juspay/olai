import { createSignal } from "solid-js"
import type { HeldOpen } from "@olai/web/client/popover.ts"

/** Approval history belongs to this inspector activation, independently of
 * its rendered door. An unrelated provider or shell replacement must not
 * silently approve a source version the reader has not acknowledged.
 *
 * Which groups this reader has opened lives here too: a switch rebuilds the
 * shell the panel is drawn in, and a walk that folded back up on that
 * remount would be the same unusable panel the live roster already was. */
export const createInspectorState = () => {
  const [open, setOpen] = createSignal(false)
  const [read, setRead] = createSignal<ReadonlyMap<string, string>>(new Map())
  const [opened, setOpened] = createSignal<Readonly<Record<string, boolean>>>({})
  let active = true
  const door: HeldOpen = { open, setOpen }
  return {
    door, read, opened,
    nowRead: (name: string, version: string) => {
      if (!active) throw new Error("The inspector activation has closed")
      setRead((was) => new Map(was).set(name, version))
    },
    setGroupOpen: (label: string, open: boolean) => {
      if (!active) throw new Error("The inspector activation has closed")
      setOpened((was) => (was[label] === open ? was : { ...was, [label]: open }))
    },
    close: () => { active = false; setOpen(false); setRead(new Map()); setOpened({}) },
  }
}
export type InspectorState = ReturnType<typeof createInspectorState>
