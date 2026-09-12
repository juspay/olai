/** An optional scoped mint. Consumers resolve the service per call, so unload
 * withdraws new credentials and reload supplies a fresh table. */
import { serviceTag } from "@olai/plugin-api/contracts"
export interface TicketMint {
  readonly mint: (
    forbidden: () => readonly { readonly key: string; readonly says: string }[],
    writer: string,
  ) => { readonly bearer: string; readonly release: () => void }
}
export const ticketMint = serviceTag<TicketMint>("mcp.ticket-mint")

/** One served tool and the plugin whose table it came from. */
export interface Advertised { readonly title: string; readonly owner: string }
export interface Catalogue {
  /** Null for another server or a tool no standing row serves. */
  readonly advertised: (server: string, tool: string) => Advertised | null
}
export const catalogue = serviceTag<Catalogue>("mcp.catalogue")
