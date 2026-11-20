import type { ChatEntry } from "olai-plugin-chat/wire"
import { TESTID } from "../../testids.ts"
import { stillOf } from "./background.ts"
import { doingOf } from "./spawn.ts"

export interface Rail {
  readonly said: string
  readonly name: string
}

export const railOf = (entry: ChatEntry | undefined): Rail | null => {
  const spawned = doingOf(entry)
  if (spawned !== null) return { said: spawned, name: TESTID.chatSpawnWorking }
  const still = stillOf(entry)
  return still === null ? null : { said: still, name: TESTID.chatArmedStill }
}

export const sameRail = (before: Rail | null, after: Rail | null): boolean =>
  before?.said === after?.said && before?.name === after?.name
