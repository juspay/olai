/** Core owns machine-local path policy; providers receive only these path
 * calculations, never the persistent-record store behind LocalState. */
import { canonical, digestOf, runtimeHome } from "@olai/state"
import type { RuntimePaths } from "@olai/ops"

export const runtimePaths: RuntimePaths = { home: runtimeHome, canonical, digest: digestOf }
