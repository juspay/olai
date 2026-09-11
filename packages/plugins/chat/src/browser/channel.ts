import { heldService } from "@olai/ui-primitives/held.ts"
import type { Channel } from "olai-plugin-alerts/contract"
const held = heldService<Channel>()
export const holdChannel = held.hold
export const useChannel = (): Channel => {
  const value = held.read()
  if (!value) throw new Error("Chat attention is unavailable")
  return value
}
