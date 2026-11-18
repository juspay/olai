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
import { createStore } from "solid-js/store"
import { itemOf } from "@olai/format"
import { heldService } from "@olai/ui-primitives/held.ts"

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

/**
 * ...AND THE CLOSES THIS TAB'S OWN READER MADE, counted per item.
 *
 * A chat page remembers which conversation it is drawing, so that a note
 * whose front matter loses the tie under an open page can offer it back
 * (`./Lost.tsx`, out of `./remembering.ts`). That memory is right for a tie
 * somebody else took away and WRONG for this press: a person who closes a
 * chat is told their own act was an outside writer's, and offered a way back
 * the whole of {@link closeCost} says they no longer have. So the press says
 * so, and the page forgets.
 *
 * A COUNTER, not a flag: a chat closed, started again and closed again is two
 * closes, and the second must still be heard by a page that is reading the
 * first. Nothing is ever removed — the keys are the items one reader pressed
 * Close on, which is bounded by that reader's own gestures.
 *
 * HELD FOR THE ACTIVATION, the way the fold beside it is (`./folding.ts`):
 * what a tab pressed is this tab's, it is never written down, and a chat
 * plugin that goes away takes it with it. A page drawn with nothing held
 * reads 0 and forgets nothing, which is the honest answer when there is no
 * chat plugin to have pressed anything.
 */
export const createCloses = () => {
  const [closes, setCloses] = createStore<Record<string, number | undefined>>({})
  return {
    at: (key: string): number => closes[key] ?? 0,
    closed: (key: string) => setCloses(key, (count) => (count ?? 0) + 1),
  }
}
const held = heldService<ReturnType<typeof createCloses>>()
export const holdCloses = held.hold
/** How many times this reader has closed that item's chat — a tracked read,
 *  so a page that is drawing one re-runs when the press lands. */
export const closedHere = (key: string): number => held.read()?.at(key) ?? 0
/** Said by the press itself, wherever Close is drawn. */
export const closeMade = (key: string): void => { held.read()?.closed(key) }
