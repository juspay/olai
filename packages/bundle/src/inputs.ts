import { offered, provide } from "./bundle.ts"
import type { Host } from "@olai/effect-cordis"
import { catalogue, type Catalogue, ticketMint, type TicketMint } from "olai-plugin-mcp/contract"
import { VaultBoot } from "olai-plugin-vault/boot"

export const provideInputs = (host: Host, input: VaultBoot) =>
  provide(host, VaultBoot, () => input)

export const ticketsFor = (host: Host) =>
  (...args: Parameters<TicketMint["mint"]>) =>
    offered(host, ticketMint)?.mint(...args) ?? null

export const advertisedFor = (host: Host): Catalogue["advertised"] =>
  (server, tool) => offered(host, catalogue)?.advertised(server, tool) ?? null
