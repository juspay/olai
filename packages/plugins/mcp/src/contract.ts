/** An optional scoped mint. Consumers resolve the service per call, so unload
 * withdraws new credentials and reload supplies a fresh table. */
import { serviceTag } from "@olai/plugin-api/contracts"
import type { Confinement } from "@olai/ops"
export interface TicketMint {
  readonly mint: (
    forbidden: () => readonly { readonly key: string; readonly says: string }[],
    writer: string,
    /** The fence, read per call — see `@olai/plugin-api`'s `Tools.ticket`. THE
     *  SAME TYPE the mint's own implementation takes (`./tickets.ts`), because a
     *  structural copy of a shape that grows a field is a copy that stops
     *  matching it. */
    confined?: () => Confinement | null,
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
