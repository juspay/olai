/** The credential owner supplies attribution through the shared call context. */
import type { ServedGeneration } from "@kolu/surface/expose"
export { authorityAt as writerAt } from "@olai/plugin-api/authority"
export type Bound = Pick<ServedGeneration, "group" | "handlers"> & { readonly writes: readonly string[] }
