import type { FileLink } from "@olai/plugin-api"
import { createStore, reconcile } from "solid-js/store"
import { createSignal } from "solid-js"
import type { HeldOpen } from "@olai/web/client/popover.ts"
export const createInspectorState = () => {
  const [open, setOpen] = createSignal(false)
  const [versions, setRead] = createStore<Record<string, string | undefined>>({})
  const read = () => ({ get: (name: string) => versions[name], get size() { return Object.keys(versions).length } })
  const [groups, setOpened] = createStore<Record<string, boolean | undefined>>({})
  const opened = () => groups
  const [rows, setExpandedRows] = createStore<Record<string, boolean | undefined>>({})
  const expanded = () => rows
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
      setRead(name, version)
    },
    setGroupOpen: (label: string, open: boolean) => {
      if (!active) throw new Error("The inspector activation has closed")
      setOpened(label, open)
    },
    setExpanded: (name: string, open: boolean) => {
      if (!active) throw new Error("The inspector activation has closed")
      setExpandedRows(name, open)
    },
    close: () => { active = false; setRequested(undefined); setFile(undefined); setOpen(false); setRead(reconcile({})); setOpened(reconcile({})); setExpandedRows(reconcile({})) },
  }
}
export type InspectorState = ReturnType<typeof createInspectorState>
