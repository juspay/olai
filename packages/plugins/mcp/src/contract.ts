/** An optional scoped mint. Consumers resolve the service per call, so unload
 * withdraws new credentials and reload supplies a fresh table. */
import { serviceTag } from "@olai/plugin-api/contracts"
export interface TicketMint {
  readonly mint: (
    seated: () => { readonly forbidden: readonly { readonly key: string; readonly says: string }[] },
    writer: string,
  ) => { readonly bearer: string; readonly release: () => void }
}
export const ticketMint = serviceTag<TicketMint>("mcp.ticket-mint")
