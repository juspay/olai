import { type ChatEntry, isStillRunning, type ToolEntry } from "olai-plugin-chat/wire"
export const isRunning = (entry: ChatEntry | undefined): entry is ToolEntry =>
  entry?.kind === "tool" && isStillRunning(entry)
