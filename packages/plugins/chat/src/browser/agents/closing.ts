/**
 * WHAT *CLOSE* DOES, in the words every face that offers it uses.
 *
 * It used to say the chat *moves to Chats*, and that was true while an
 * engine's conversations were filed as rows under `Inbox › Chats`. Nothing
 * files anything now: a conversation is somebody's only because an item — a
 * node or a note — NAMES it, so taking the tie off is the whole of the act,
 * and what it costs is that olai lists that conversation nowhere afterwards.
 * The transcript is not deleted; it stays in the engine's own store, and a
 * person who wants it back names it on a row or in a note's front matter by
 * hand. But nothing on screen leads to it, and a button that did not say so
 * was asking for a press nobody could undo from the page they were on.
 *
 * ONE COPY, in the places that offer it: the line under a conversation
 * (`./CloseAgent.tsx`) and the `•••` of a row and of a Chats row, both off
 * one list of verbs (`../verbs.tsx`'s `chatVerbs`). ⌘K deliberately does not
 * offer it at all (`./AgentPalette.ts`). Two copies of a sentence about a
 * loss is how one of them goes on promising something the other has stopped
 * doing, which is the mistake this module is the repair of.
 *
 * NO QUESTION IS ASKED FIRST, and that is a decision rather than an omission.
 * Only the outline's `•••` can draw a confirm (`olai-plugin-outlines`'
 * `RowVerb.confirm`); the Chats row's menu runs a verb's press directly, and
 * the line under a conversation would need a question of its own. A warning a
 * person gets or misses depending on which door they came through is worse
 * than one sentence that is the same everywhere, so the sentence is the
 * warning. Should the other doors learn to ask, this is the copy the question
 * would be built from.
 */
import { itemOf } from "@olai/format"

/** The words on the control, wherever it is drawn. */
export const CLOSE_CHAT = "Close the chat"

/** ...and what the press costs, for the item it is about: a node keeps its
 *  tie on its row, a note in its front matter, and the sentence names the one
 *  the reader is looking at. */
export const closeCost = (key: string): string =>
  `The tie comes off this ${itemOf(key).kind === "note" ? "note" : "row"}, `
  + "and the conversation is listed nowhere in olai afterwards."

/** The whole sentence a tip and a screen reader get: what it is, then what it
 *  costs. */
export const closeTip = (key: string): string => `${CLOSE_CHAT}. ${closeCost(key)}`
