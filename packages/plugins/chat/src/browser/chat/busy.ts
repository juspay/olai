import { agentIn, type ChatState } from "olai-plugin-chat/wire"
export type Busy =
  | { readonly kind: "starting"; readonly agent: string | null }
  | { readonly kind: "working"; readonly agent: string | null }
  | { readonly kind: "waiting" }

export const busyIn = (state: ChatState): Busy | null => {
  const who = () => agentIn(state)?.name ?? null
  if (state.status === "booting") return { kind: "starting", agent: who() }
  if (state.status !== "thinking") return null
  if (state.sleep) return { kind: "working", agent: who() }
  return state.asking > 0 ? { kind: "waiting" } : { kind: "working", agent: who() }
}
