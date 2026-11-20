import {
  type Custom,
  customOf,
  customOrder,
  type RegularNode,
  storedMarker,
} from "@olai/format"

export interface Entry {
  readonly key: string
  readonly value: string
  readonly values: ReadonlyArray<string>
  readonly system: boolean
  readonly listed: boolean
}

export const systemEntries = (node: RegularNode): ReadonlyArray<Entry> => {
  const out: Array<Entry> = [said("id", node.id)]
  const mark = storedMarker(node)
  if (mark !== undefined) {
    const held = node[mark]
    out.push(said("status", typeof held === "string" ? `${mark} ${held}` : mark))
  }
  if (node.date !== undefined) out.push(said("date", node.date))
  for (const stamp of ["created", "changed"] as const) {
    const held = node[stamp]
    if (held !== undefined) out.push(said(stamp, held))
  }
  return out
}

const said = (key: string, value: string): Entry => ({
  key,
  value,
  values: [value],
  system: true,
  listed: false,
})

export const customEntries = (custom: Custom, placement?: {
  readonly kind: (key: string, value: string) => string | undefined
  readonly at: (kind: string) => { readonly inRows: boolean } | undefined
}): ReadonlyArray<Entry> => {
  return customOrder(custom).flatMap((key) => {
    const value = custom[key]
    if (value === undefined) return []
    const listed = typeof value !== "string"
    const values = listed ? value : [value]
    if (placement !== undefined && values.length > 0 && values.every(value => {
      const kind = placement.kind(key, value)
      return kind !== undefined && placement.at(kind)?.inRows === false
    })) return []
    return [{ key, value: values.join(", "), values, system: false, listed }]
  })
}

export const drawerEntries = (node: RegularNode): ReadonlyArray<Entry> => [
  ...systemEntries(node),
  ...customEntries(customOf(node)),
]
