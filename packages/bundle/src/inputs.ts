/** Product-specific inputs are adapted at the bundle boundary. The host can
 * supply paths and request tickets without knowing which plugin consumes or
 * provides them. Looking up the mint on every call preserves withdrawal: a
 * departed MCP provider never leaves an old issuer installed in the host. */
import { offered, provide } from "./bundle.ts"
import type { Host } from "@olai/effect-cordis"
import { ticketMint, type TicketMint } from "olai-plugin-mcp/contract"
import { VaultBoot } from "olai-plugin-vault/boot"

export const provideInputs = (host: Host, input: VaultBoot) =>
  provide(host, VaultBoot, () => input)

export const ticketsFor = (host: Host) =>
  (...args: Parameters<TicketMint["mint"]>) =>
    offered(host, ticketMint)?.mint(...args) ?? null
