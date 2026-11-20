import { type ChatEntry, isAgentOut, isTaskOut, outSince, sentToDo } from "olai-plugin-chat/wire"
import type { Watching } from "@kolu/acp/wire"
export const watching = (
  entries: ReadonlyMap<string, ChatEntry>,
): ReadonlyArray<Watching> => {
  const out: Array<Watching> = []
  for (const [key, entry] of entries) {
    if (entry.kind !== "tool") continue
    if (isAgentOut(entry)) {
      out.push({
        row: key,
        kind: "agent",
        name: sentToDo(entry.spawned, entry.text),
        since: outSince(entry),
      })
    }
    else if (isTaskOut(entry)) {
      out.push({
        row: key,
        kind: "task",
        name: entry.armed?.description ?? entry.text,
        since: outSince(entry),
      })
    }
  }
  return out
}

export const sameWatching = (
  now: ReadonlyArray<Watching>,
  before: ReadonlyArray<Watching>,
): boolean =>
  now.length === before.length
  && now.every((task, at) =>
    task.row === before[at]?.row
    && task.kind === before[at]?.kind
    && task.name === before[at]?.name
    && task.since === before[at]?.since
  )
