/**
 * `chat.beside` — PUTTING A CONVERSATION IN THE PANE BESIDE A PAGE, as a row
 * that is not chat asks for it.
 *
 * ## One verb, and it is the whole gesture
 *
 * A chat has an address now (`/chat/<item>`), so *open it beside this page*
 * is two decisions: which pane the conversation goes in, and what to do when
 * a pane in this layout already has it. Both are chat's — they are the
 * drawn-once rule (`./browser/agents/beside.ts`) and the router's own
 * `openRight`, and a consumer that made them for itself would be a second
 * author of where conversations appear. So the door is {@link BesideDoor.open}
 * and nothing else: an item, the pane the press was made in, and chat does
 * the rest.
 *
 * `olai-plugin-vault-plugins` is the one consumer: a plugin's page offers
 * *Ask for a change…* over the chat of its README note.
 *
 * ## OFFERED BY THE COMPONENT THAT HOLDS THE ROUTER
 *
 * Opening a pane is a router call, so this key is offered by chat's
 * `navigation` component — the one that declares `navigation.state`. A serve
 * with no router mounted holds the consumer `waiting` naming *chat.beside*
 * rather than handing it a door that would do nothing when pressed, and the
 * page simply draws no verb.
 */
import { serviceTag } from "@olai/plugin-api/contracts"
import type { AgentItem } from "@olai/format"

/** What chat offers of a conversation's pane: put it beside the page the
 *  press came from. */
export interface BesideDoor {
  /**
   * Open this item's chat in the pane to the RIGHT of `from`, or focus the
   * pane that already has it. The pane pressed in is never taken away: the
   * person is reading that page.
   *
   * An item with no chat yet opens its chat page all the same — that page is
   * the box that starts one.
   */
  readonly open: (input: { readonly item: AgentItem; readonly from: number }) => void
}

/** The local word chat's `navigation` component offers it under. */
export const BESIDE = "beside"

export const chatBeside = serviceTag<BesideDoor>("chat.beside")
