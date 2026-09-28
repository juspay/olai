/** Approval history belongs to this inspector activation, independently of
 * its rendered door. An unrelated provider or shell replacement must not
 * silently approve a source version the reader has not acknowledged.
 *
 * Which groups this reader has opened lives here too, and so does which rows
 * they have expanded: a switch rebuilds the shell the panel is drawn in, and a
 * walk that folded back up on that remount would be the same unusable panel
 * the live roster already was. Closing the activation forgets both. */
import type { FileLink } from "@olai/plugin-api"
import { createSignal } from "solid-js"
import type { HeldOpen } from "@olai/web/client/popover.ts"
export const createInspectorState = () => {
  const [open, setOpen] = createSignal(false)
  const [read, setRead] = createSignal<ReadonlyMap<string, string>>(new Map())
  const [opened, setOpened] = createSignal<Readonly<Record<string, boolean>>>({})
  const [expanded, setExpandedRows] = createSignal<Readonly<Record<string, boolean>>>({})
  const [file, setFile] = createSignal<FileLink>()
  const [requested, setRequested] = createSignal<string>()
  let active = true
  const door: HeldOpen = { open, setOpen }
  return {
    door, read, opened, expanded, file, requested,
    reveal: (name: string) => {
      if (!active) throw new Error("The inspector activation has closed")
      setRequested(name)
      setOpen(true)
    },
    revealed: (name: string) => { if (requested() === name) setRequested(undefined) },
    link: (value: FileLink) => {
      if (!active) throw new Error("The inspector activation has closed")
      setFile(() => value)
      return () => { if (file() === value) setFile(undefined) }
    },
    nowRead: (name: string, version: string) => {
      if (!active) throw new Error("The inspector activation has closed")
      setRead((was) => new Map(was).set(name, version))
    },
    setGroupOpen: (label: string, open: boolean) => {
      if (!active) throw new Error("The inspector activation has closed")
      setOpened((was) => (was[label] === open ? was : { ...was, [label]: open }))
    },
    /** A row's detail shown or hidden, by the row's plugin name. Absent is the
     *  row's own default: expanded while it needs attention, shut otherwise. */
    setExpanded: (name: string, open: boolean) => {
      if (!active) throw new Error("The inspector activation has closed")
      setExpandedRows((was) => (was[name] === open ? was : { ...was, [name]: open }))
    },
    close: () => { active = false; setRequested(undefined); setFile(undefined); setOpen(false); setRead(new Map()); setOpened({}); setExpandedRows({}) },
  }
}
export type InspectorState = ReturnType<typeof createInspectorState>
