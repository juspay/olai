import { location } from "@olai/plugin-api/contracts"
import type { SidebarProps } from "olai-plugin-layout/contract"
import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import type { JSX } from "solid-js"
export interface SidebarRegionProps extends SidebarProps { readonly slots: RendererSlots }
export const regions = location<{readonly at: "primary" | "shelf" | "files"; readonly Body: (props: SidebarRegionProps) => JSX.Element}>("sidebar.regions")
export const vaultEntries = location<(props: SidebarRegionProps) => JSX.Element>("sidebar.vault")
export const railEntries = location<() => JSX.Element>("sidebar.rail")
