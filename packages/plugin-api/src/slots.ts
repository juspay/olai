/** Generic compatibility facade vocabulary. Capabilities augment the types and
 * own their concrete descriptors; this module has no application catalog. */
import { location, locationReference, type Location } from "@olai/effect-cordis"
export type SlotKey = "plugin" | "kind" | "app" | "nothing"
export interface SlotDefinition<F, K extends SlotKey = SlotKey> {readonly face: F; readonly keyedBy: K}
export interface SlotDefinitions {}
export interface Hung<F> {readonly plugin: string;readonly face: F}
export interface SlotContract<F> extends Location<Hung<F>> {readonly slotKey: SlotKey}
export const slotContract = <F>(name: string, keyedBy: SlotKey): SlotContract<F> => Object.freeze({
  ...location<Hung<F>>(name,keyedBy === "app" ? "one" : "many",keyedBy === "plugin" ? "owner" : keyedBy === "kind" ? "key" : undefined),
  slotKey: keyedBy,
})
export const slotReference = <F>(name: string) => locationReference<Hung<F>>(name)

/** Inert discovery uses only descriptors exported by supplied capability
 * modules. An absent module contributes no contract; this keeps no registry. */
export const slotCatalog = (modules: Iterable<unknown>): ReadonlyArray<{readonly name: string;readonly keyedBy: SlotKey}> => {
  const entries: Array<{readonly name: string;readonly keyedBy: SlotKey}> = []
  for (const module of modules) {
    if (module === null || typeof module !== "object") continue
    const descriptors = (module as {slots?: unknown}).slots
    if (descriptors === null || typeof descriptors !== "object") continue
    for (const value of Object.values(descriptors)) {
      if (value === null || typeof value !== "object") continue
      const descriptor = value as {name?: unknown;slotKey?: unknown}
      if (typeof descriptor.name !== "string" || !["plugin","kind","app","nothing"].includes(String(descriptor.slotKey))) continue
      entries.push(Object.freeze({name:descriptor.name,keyedBy:descriptor.slotKey as SlotKey}))
    }
  }
  return Object.freeze(entries)
}
