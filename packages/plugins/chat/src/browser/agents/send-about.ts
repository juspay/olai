import { type AgentItem, UsageFailure } from "@olai/format"

import { keepMessage } from "../chat/message-draft.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"

export const ABOUT_NOTE = "Sending starts a chat about this note · the chat is kept in its front matter"
export const ABOUT_NODE = "Sending starts a chat about this row · the rows under it are its memory"

export interface Sent {
  readonly started: string | null
  readonly talking: boolean
  readonly said: string | null
}

export const sendAbout = async (input: { readonly item: AgentItem; readonly engine: string; readonly text: string }): Promise<Sent> => {
  const reading = agentReadings()
  if (reading === undefined) return { started: null, talking: false, said: "Chat isn't available" }
  const made = await reading.newChat.about(input)
  if (typeof made === "string") return { started: null, talking: false, said: made }
  if (made.to === null && made.refusal !== null) return { started: null, talking: false, said: made.refusal }
  if (made.to === null) {
    const row = { kind: "row", node: made.node } as const
    const waiting = reading.unsent(row)
    reading.setUnsent(row, waiting === "" ? input.text : `${input.text}\n${waiting}`)
  } else if (made.refusal !== null) {
    const ui = reading.ui(made.to)
    keepMessage(ui.messages, JSON.stringify([made.to.agent, made.to.session]), input.text, true)
    ui.refused[1](new UsageFailure({ reason: made.refusal }))
  }
  unfold(made.node)
  return { started: made.node, talking: made.to !== null, said: null }
}
