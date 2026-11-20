import { padiSocketPath, productionPadiStateRoot } from "@kolu/padi-client/rendezvous"

export const PADI_SOCKET = "PADI_SOCKET"

export interface Rendezvous {
  readonly path: string
  readonly told: boolean
}

export const rendezvousIn = (env: Record<string, string | undefined>): Rendezvous => {
  const told = env[PADI_SOCKET]
  if (told !== undefined && told !== "") return { path: told, told: true }
  return { path: padiSocketPath(productionPadiStateRoot()), told: false }
}
