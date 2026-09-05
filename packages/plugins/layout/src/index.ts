import { location } from "@olai/plugin-api/contracts"
import type { BrokenFile } from "@olai/format"
import type { InboxHeld } from "@olai/surface"
import type { JSX } from "solid-js"

export const name = "layout"
/** Transitional notebook inputs, removed as content readings become services.
 * The contract imports no sidebar implementation. */
export interface SidebarProps {
  readonly active: string | undefined
  readonly broken: ReadonlyMap<string, BrokenFile>
  readonly inboxHeld: InboxHeld
  readonly foot?: JSX.Element
  readonly open: boolean
  readonly onClose: () => void
}
export interface SidebarSeat {
  readonly Sidebar: (props: SidebarProps) => JSX.Element
  readonly Rail: (props: { readonly home: () => void }) => JSX.Element
}
export const sidebar = location<SidebarSeat>("layout.sidebar", "one")
