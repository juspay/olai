import { serviceTag } from "@olai/plugin-api/contracts"
import type { AgentItem } from "@olai/format"

export interface BesideDoor {
  readonly open: (input: { readonly item: AgentItem; readonly from: number }) => void
}

export const BESIDE = "beside"

export const chatBeside = serviceTag<BesideDoor>("chat.beside")
