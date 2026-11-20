import { type Accessor, createMemo, createSignal } from "solid-js"
import { createPreference } from "@olai/web/client/preference.ts"

const preference = createPreference("olai.sidebar.reference", {
  parse: (raw: string | null) => raw === "true",
  print: (open: boolean) => open ? "true" : null,
})

export const followReference = preference.follow

export const createReferenceFold = (
  active: Accessor<string | undefined>,
  contains: (file: string) => boolean,
) => {
  const [collapsedAt, setCollapsedAt] = createSignal<{ readonly at: string | undefined } | null>(null)
  const collapse = createMemo((previous: { chosen: { readonly at: string | undefined } | null; at: string | undefined; collapsed: boolean } | undefined) => {
    const chosen = collapsedAt(), at = active()
    return { chosen, at, collapsed: previous !== undefined && previous.chosen === chosen && previous.at !== at ? false : previous !== undefined && previous.chosen === chosen ? previous.collapsed : chosen !== null && chosen.at === at }
  })
  const collapsed = () => collapse().collapsed
  const selected = () => {
    const file = active()
    return file !== undefined && contains(file)
  }
  const open = () => !collapsed() && (preference.value() || selected())
  return {
    open,
    toggle: () => {
      const next = !open()
      setCollapsedAt(next ? null : { at: active() })
      preference.set(next)
    },
  }
}
