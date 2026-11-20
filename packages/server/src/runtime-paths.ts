import { canonical, digestOf, runtimeHome } from "@olai/state"
import type { RuntimePaths } from "@olai/ops"

export const runtimePaths: RuntimePaths = { home: runtimeHome, canonical, digest: digestOf }
