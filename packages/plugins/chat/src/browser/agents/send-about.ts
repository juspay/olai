/**
 * ONE PRESS OF A DOOR — how a chat about an ITEM is started where that item
 * is, as a plain function with no face in it.
 *
 * The doors themselves are three: the one-row box in the line at the top of a
 * note (`./NoteLine.tsx`), the palette's **Chat about this page** level
 * (`./AgentPalette.ts` and `./new-chat-level.ts`), and the *Ask about
 * <name>…* box a chat page draws for an item that has no chat yet
 * (`./Door.tsx`'s `AboutBox`, which `./ChatPage.tsx` draws). All of them send
 * through {@link sendAbout}, so a refusal means one thing everywhere.
 *
 * SEPARATE FROM THE BOX, in a module with no JSX, because the palette's
 * levels are plain values a bun test loads directly: a level module that
 * reached the send through a component file would drag a renderer in with it.
 *
 * Sending writes the tie where that kind of item keeps one — a note's own
 * front matter, a node's row — starts the agent and hands it the words, once,
 * through the server (`./new-chat.ts`'s `about`). A refused start leaves the
 * words in the box and says why; the item keeps the engine it was asked for,
 * so a retry starts on the same item rather than making a second chat
 * anywhere (`../../server/new-chat.ts`).
 *
 * A door is offered while the item has no conversation (`talking`), not only
 * while it has no tie: an item whose start was refused is still its own door.
 */
import { type AgentItem, UsageFailure } from "@olai/format"

import { keepMessage } from "../chat/message-draft.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"

/** The words under the box, which say what sending does — one sentence per
 *  kind of item, because what carries the tie and what the memory IS are
 *  different facts about the two. */
export const ABOUT_NOTE = "Sending starts a chat about this note · the chat is kept in its front matter"
export const ABOUT_NODE = "Sending starts a chat about this node · the rows under it are its memory"

/** What one press of a door came to: the chat row that now has a conversation
 *  (or is waiting at sign-in), or `null` with the sentence that says why not —
 *  in which case the words stay where they were typed. */
export interface Sent {
  readonly started: string | null
  readonly talking: boolean
  readonly said: string | null
}

/**
 * ONE PRESS OF A DOOR.
 *
 *   - nothing created, or a start the agent refused: the words stay in the box
 *     that sent them, and the sentence is shown;
 *   - a start that stopped at sign-in: the item's chat exists with no
 *     conversation yet, so the words become its unsent words, which the page
 *     session hands to the conversation once it opens;
 *   - a conversation the first message did not reach: the words wait in its
 *     composer, with the sentence over it.
 *
 * Anything that started opens the item's fold, so the person sees it.
 */
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
