import type { ChatEntry } from "olai-plugin-chat/wire"
import { sentOf, whoOf } from "./spawn.ts"

export type Door =
  | { readonly kind: "none" }
  | { readonly kind: "door"; readonly label: string }

const NO_DOOR: Door = { kind: "none" }

export const doorOf = (entry: ChatEntry | undefined, calls: number): Door => {
  if (whoOf(entry) === null) return NO_DOOR
  if (calls <= 0) return NO_DOOR
  const many = calls === 1 ? "1 call" : `${calls} calls`
  const sent = sentOf(entry)
  const said = sent === null || sent === (entry?.kind === "tool" ? entry.text : null)
    ? many
    : `${sent} · ${many}`
  return { kind: "door", label: said }
}
