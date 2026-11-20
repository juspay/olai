import { offered, provide } from "./bundle.ts"
import type { Host } from "@olai/effect-cordis"
import { catalogue, type Catalogue, ticketMint, type TicketMint } from "olai-plugin-mcp/contract"
import { VaultBoot } from "olai-plugin-vault/boot"

export const provideInputs = (host: Host, input: VaultBoot) =>
  provide(host, VaultBoot, () => input)

export const ticketsFor = (host: Host) =>
  ({ forbidden, writer, confined }: {
    readonly forbidden: Parameters<TicketMint["mint"]>[0]
    readonly writer: Parameters<TicketMint["mint"]>[1]
    readonly confined?: Parameters<TicketMint["mint"]>[2]
  }) => offered(host, ticketMint)?.mint(forbidden, writer, confined) ?? null

export const advertisedFor = (host: Host): Catalogue["advertised"] =>
  (server, tool) => offered(host, catalogue)?.advertised(server, tool) ?? null
