import { serviceTag } from "@olai/plugin-api/contracts"
import type { RuntimePaths } from "@olai/ops"
export interface VaultBoot { readonly root: string; readonly runtime: RuntimePaths }
export const VaultBoot = serviceTag<VaultBoot>("vault.boot")
