import type { InTheWay } from "@olai/format"

export { ROW_DIM } from "../contracts/chrome.ts"
import { ROW_DIM } from "../contracts/chrome.ts"

export const WAITING_DIM = (blocked: ReadonlyArray<InTheWay>): string =>
  blocked.length > 0 ? ROW_DIM : ""

export const blockedIds = (
  blocked: ReadonlyArray<InTheWay>,
): string | undefined =>
  blocked.length === 0 ? undefined : blocked.map((one) => one.at.node.id).join(" ")
