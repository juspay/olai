/**
 * Reference visibility: a stored default plus a temporary selection reveal.
 *
 * Folder-path preferences change independently of this section preference.
 * The Files activation follows storage; each mounted section owns its collapse
 * override, which expires on navigation or disposal (including reload).
 */
import { type Accessor, createEffect, createSignal, on } from "solid-js"
import { createPreference } from "@olai/web/client/preference.ts"

const preference = createPreference("olai.sidebar.reference", {
  parse: (raw: string | null) => raw === "true",
  print: (open: boolean) => open ? "true" : null,
})

export const followReference = preference.follow

/** Compose selection with storage without letting navigation write storage. */
export const createReferenceFold = (
  active: Accessor<string | undefined>,
  contains: (file: string) => boolean,
) => {
  const [collapsed, setCollapsed] = createSignal(false)
  createEffect(on(active, () => setCollapsed(false)))
  const selected = () => {
    const file = active()
    return file !== undefined && contains(file)
  }
  const open = () => !collapsed() && (preference.value() || selected())
  return {
    open,
    toggle: () => {
      const next = !open()
      setCollapsed(!next)
      preference.set(next)
    },
  }
}
