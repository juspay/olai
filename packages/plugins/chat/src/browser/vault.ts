/**
 * THE SERVED DIRECTORY, as the composer and the wake strip read it — held for the activation that
 * declared it.
 *
 * The membership and the per-file revision are `olai-plugin-vault`'s, and they
 * arrive on `vault.files`, a service this row already names. `heldFiles`
 * carries the design — why a factory, and why the reads answer the empty
 * directory rather than throwing where nobody is holding one.
 */
import { heldFiles } from "olai-plugin-vault/file-state"

/** Told by this row, for its activation — and read by its faces. */
export const { holdServed, servedDirectory, useServed, useHead } = heldFiles()
