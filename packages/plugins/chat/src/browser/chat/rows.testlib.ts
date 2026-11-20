import type { ToolEntry } from "olai-plugin-chat/wire"
export const toolRow = (extra: Partial<ToolEntry> = {}): ToolEntry => ({
  id: "tool:agent-1",
  seq: 0,
  since: "2026-08-21T12:00:00.000Z",
  kind: "tool",
  text: "explore the outline",
  status: "pending",
  ...extra,
})
