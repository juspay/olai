/** Read-only location access for mounted faces. The renderer installs this
 * capability for its activation; this module creates no renderer or slot host. */
import { createSignal } from "solid-js"
import type { Locations } from "@olai/plugin-api/contracts"
const [reader, setReader] = createSignal<Locations["read"] | undefined>()
export const holdLocationReader = (read: Locations["read"]): (() => void) => {
  setReader(() => read)
  return () => { if (reader() === read) setReader(undefined) }
}
export const readLocation: Locations["read"] = slot => reader()?.(slot) ?? []
