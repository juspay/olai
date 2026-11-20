import { narrowAgentState, recencyText } from "@kolu/solid-dockrow/rowValues"

import type { KoluEvent } from "olai-plugin-kolu/appliance/wire"
import { reminderAccount, whoOf } from "olai-plugin-kolu/appliance/wire"

export interface EventLine {
  readonly asking: boolean
  readonly who: string
  readonly label: string
  readonly labelColor: string
  readonly words: string
  readonly age: string
  readonly about: string | null
}

const stateWord = (agentState: string | null, state: string): string =>
  (narrowAgentState(agentState).label ?? state).toLowerCase()

export const eventLine = (event: KoluEvent, now: number): EventLine => {
  const row = event.row
  const atMs = Date.parse(event.at)
  const age = recencyText("ago", atMs, Math.max(now, atMs))
  if (row === null) {
    return {
      asking: false,
      who: "",
      label: "",
      labelColor: "",
      words: "",
      age,
      about: null,
    }
  }
  const held = recencyText("wait-chip", Date.parse(row.since), atMs)
  const word = stateWord(row.agentState, row.state)
  const account = reminderAccount(event.kind === "nag" ? event.nag : undefined)
  const count = account === null
    ? ""
    : account.total === null
    ? ` — reminder ${account.index}`
    : ` — reminder ${account.index} of ${account.total}${account.last ? ", the last" : ""}`
  const words = event.kind === "nag"
    ? `still ${word} for ${held}${count}`
    : `has been ${word} for ${held}`
  return {
    asking: row.pip.asking,
    who: whoOf(row.repo, row.label),
    label: row.label,
    labelColor: row.labelColor,
    words,
    age,
    about: row.terminal,
  }
}
