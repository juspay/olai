import { resolveTerminal } from "olai-plugin-kolu/appliance/wire"
import type { FleetTerminal, KoluLink } from "olai-plugin-kolu/appliance/wire"

export interface TerminalReading {
  readonly row?: FleetTerminal
  readonly says: string
}

export const noPadiSays = (link: KoluLink): string => {
  if (link.status === "skew") {
    return `kolu and olai versions don't match (padi ${link.surfaceVersion ?? "?"}, olai ${link.speaks}). Update one of them.`
  }
  if (link.socket === "") return "kolu isn't set up."
  return link.told
    ? `kolu isn't running at ${link.socket} (from $PADI_SOCKET).`
    : `kolu isn't running. Looked at ${link.socket}.`
}

export const readingOf = (
  value: string,
  link: KoluLink,
  fleet: ReadonlyMap<string, FleetTerminal>,
): TerminalReading => {
  if (link.status !== "connected") return { says: noPadiSays(link) }
  const found = resolveTerminal(value, fleet.keys())
  if (found.kind === "many") {
    return {
      says: `${found.count} terminals match. Type more of the id.`,
    }
  }
  const row = found.kind === "one" ? fleet.get(found.id) : undefined
  if (row === undefined) {
    return { says: "This terminal was closed." }
  }
  return { row, says: "" }
}
