/**
 * THE ONE SEAT THIS ROW OWNS: a plugin's own page, at `/plugins/<word>/app`.
 *
 * Declared by the browser half's `page` component as a child of the route it
 * contributes (`./browser.tsx`), so the seat lives exactly as long as the
 * address does, and a face hung in it while the row is off waits rather than
 * drawing nowhere. Keyed by PLUGIN: one page per plugin, and the key is the
 * registering plugin's own name, stamped by `Slots`, so a plugin can only ever
 * fill the page under its own word.
 *
 * Exported as `slots` from the server door (`./server.ts`), which is what
 * `vault-plugins_inspect` reads to tell an author the seat exists.
 */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

/** The plugin's page, handed the path below `/plugins/<word>/app/` — `""` at
 *  `/plugins/<word>/app` itself. */
export type PluginPageFace = (props: { readonly rest: string }) => JSX.Element

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "plugin.page": SlotDefinition<PluginPageFace, "plugin">
  }
}

export const slotContracts = {
  "plugin.page": slotContract<PluginPageFace>("plugin.page", "plugin",
    "A component handed `{ rest }`, the path after `/plugins/<word>/app/` (`\"\"` at `/plugins/<word>/app`), drawn as the plugin's own page at that address while the plugin runs; one per plugin, always under its own word."),
} as const
