import { serviceTag } from "@olai/plugin-api/contracts"
import type { Confinement } from "@olai/ops"
export interface TicketMint {
  readonly mint: (
    forbidden: () => readonly { readonly key: string; readonly says: string }[],
    writer: string,
    confined?: () => Confinement | null,
  ) => { readonly bearer: string; readonly release: () => void }
}
export const ticketMint = serviceTag<TicketMint>("mcp.ticket-mint")

export interface Advertised { readonly title: string; readonly owner: string }
export interface Catalogue {
  readonly advertised: (server: string, tool: string) => Advertised | null
}
export const catalogue = serviceTag<Catalogue>("mcp.catalogue")
