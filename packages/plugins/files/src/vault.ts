/**
 * THE SERVED DIRECTORY, as the file tree reads it — held for the activation that
 * declared it.
 *
 * The membership and the per-file revision are `olai-plugin-vault`'s, and they
 * arrive on `vault.files` — a service this row already names. They used to
 * arrive as `useServed`/`useHead`: a module variable in the vault's own
 * `./browser/served.tsx`, installed by that row's activation and read by five
 * other packages with no dependency declared anywhere (the audit's §12).
 *
 * WHAT THE READS ANSWER WITH NO VAULT is the empty directory rather than a
 * throw, and that is a narrowing of the old behaviour rather than a widening:
 * every reader here draws under an activation that NAMES `vault.files`, so the
 * absence is unreachable from a face — and where the module holder threw, a
 * declared dependency simply leaves the component `waiting` with its row
 * running, which is the state the runtime is for.
 */
import type { Accessor } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"
import type { Directory } from "olai-plugin-vault/file-state"

const provider = heldService<Directory>()

/** Told by `./browser.tsx`'s row, for that activation. */
export const holdVault = provider.hold

/** The served directory itself, or nothing. */
export const servedDirectory = provider.read

/** Every served path, in directory order. */
export const useServed = (): Accessor<ReadonlyArray<string>> =>
  () => provider.read()?.paths() ?? []

/** ...and which revision one served file is at — the question a reader asks
 *  when what it needs to know is that the file MOVED. */
export const useHead = (file: Accessor<string>): Accessor<number | undefined> =>
  () => provider.read()?.head(file)()
