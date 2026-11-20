import { heldService } from "@olai/ui-primitives/held.ts"
import type { NewPlugin } from "olai-plugin-vault-plugins/contract"

const provider = heldService<NewPlugin>()

export const holdAsking = provider.hold

export const asking = provider.read
