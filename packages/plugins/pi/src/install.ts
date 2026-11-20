import type { NotHere } from "@kolu/acp/engine"

export const NAME = "Pi"

export const ADAPTER_GONE: NotHere = {
  name: NAME,
  where: null,
  why: "OLAI_ACP_PI is unset or empty — start olai with the wrapper that carries the pinned pi adapter",
}

export const INSTALL: NotHere = {
  name: NAME,
  where: "https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent",
  why: "put `pi` on this server's PATH — the adapter for it comes with olai",
}
