import { heldService } from "@olai/ui-primitives/held.ts"
import type { Approvals } from "olai-plugin-vault-plugins/contract"

const provider = heldService<Approvals>()

export const holdApprovals = provider.hold

export const approvals = provider.read
