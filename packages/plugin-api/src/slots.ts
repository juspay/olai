/** Generic compatibility facade vocabulary. Capabilities augment the types and
 * own their concrete descriptors; this module has no application catalog. */
import { location, locationReference, type Location } from "@olai/effect-cordis"
export type SlotKey = "plugin" | "kind" | "app" | "nothing"
export interface SlotDefinition<F, K extends SlotKey = SlotKey> {readonly face: F; readonly keyedBy: K}
export interface SlotDefinitions {}
export interface Hung<F> {readonly plugin: string;readonly face: F}
/** A slot as its owner declares it. `handed` is the owner's one sentence saying
 *  what a face contributed there is and what it is handed when it is drawn —
 *  the line an author reads in `vault-plugins_inspect` before writing one. */
export interface SlotContract<F> extends Location<Hung<F>> {readonly slotKey: SlotKey;readonly handed: string}
export const slotContract = <F>(name: string, keyedBy: SlotKey, handed: string): SlotContract<F> => Object.freeze({
  ...location<Hung<F>>(name,keyedBy === "app" ? "one" : "many",keyedBy === "plugin" ? "owner" : keyedBy === "kind" ? "key" : undefined),
  slotKey: keyedBy,
  handed,
})
export const slotReference = <F>(name: string) => locationReference<Hung<F>>(name)

/** One slot as the catalog describes it. */
export interface SlotEntry {readonly name: string;readonly keyedBy: SlotKey;readonly handed: string}

/** Inert discovery uses only descriptors exported by supplied capability
 * modules. An absent module contributes no contract; this keeps no registry.
 * A descriptor that does not say what its face is handed is not listed: an
 * author told a slot exists and not what it passes writes a face that reads
 * `undefined`. */
export const slotCatalog = (modules: Iterable<unknown>): ReadonlyArray<SlotEntry> => {
  const entries: Array<SlotEntry> = []
  for (const module of modules) {
    if (module === null || typeof module !== "object") continue
    const descriptors = (module as {slots?: unknown}).slots
    if (descriptors === null || typeof descriptors !== "object") continue
    for (const value of Object.values(descriptors)) {
      if (value === null || typeof value !== "object") continue
      const descriptor = value as {name?: unknown;slotKey?: unknown;handed?: unknown}
      if (typeof descriptor.name !== "string" || !["plugin","kind","app","nothing"].includes(String(descriptor.slotKey))) continue
      if (typeof descriptor.handed !== "string" || descriptor.handed.trim() === "") continue
      entries.push(Object.freeze({name:descriptor.name,keyedBy:descriptor.slotKey as SlotKey,handed:descriptor.handed}))
    }
  }
  return Object.freeze(entries)
}
