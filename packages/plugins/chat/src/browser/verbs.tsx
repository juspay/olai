/** The row menu's agent verbs: start, fresh start, put to sleep, tidy, close. */
import type { RowAction, RowVerb } from "olai-plugin-outlines/slots"
import { Result } from "effect"
import { runAsync } from "@olai/web/client/run.ts"
import type { Roster } from "./agents/answered.tsx"
import { seated, type Row } from "./agents/roster.ts"
import { agentReadings } from "./agents/reading.ts"
import { fold, unfold } from "./agents/folding.ts"
import { chatWire } from "./wire.ts"

import { freshStartQuestion } from "./agents/fresh-start.ts"

/**
 * ONE ENTRY per gesture, however many engines: a choice of the engines that
 * can start (`RowChoice`), which outlines draws as a submenu, as the verb
 * itself when there is one, and not at all when there are none. Engines this
 * machine lacks are never offered; the plugins panel says what they need.
 *
 * `above` answers the nearest ancestor holding a conversation
 * (`./agents/above.ts`), resolved WHEN THE MENU IS ASKED rather than here: the
 * entry appears only while an ancestor is bound, and its press asks again so a
 * roster that moved between opening the menu and pressing it cannot open the
 * wrong conversation. It is optional so the unit tests can hold the roster
 * alone; with no resolver there is no entry, which is the same answer as a node
 * with nothing bound above.
 */
export const rowVerbs = (
  node: string,
  roster: Roster,
  above?: (node: string) => Row | undefined,
  /** Take the reader to that ancestor's conversation — the door is the slot's
   *  caller's, so this module keeps no router and a unit test of the roster
   *  alone loads no navigation (`./browser.tsx` passes `./agents/focus.ts`'s). */
  open?: (row: Row) => string | void,
): ReadonlyArray<RowAction> => {
  const openAbove: RowAction | undefined = (() => {
    if (above?.(node) === undefined) return undefined
    return {
      id: "open-agent-above", label: "Open the agent above", writes: false,
      run: (node: string) => {
        const row = above?.(node)
        if (row === undefined) return
        return open === undefined ? "Can't open this right now" : open(row)
      },
    }
  })()
  /** THE START GESTURE, SHARED BY BOTH HALVES: start a session on a node with
   *  a given engine, and on success mark the node read and unfold it. The
   *  start and fresh-start entries are the same act on different labels. */
  const startOn = (engine: { readonly id: string }) => async (node: string) => {
    const outcome = await runAsync(chatWire().procedures.conversation.startAgentSession({ node, agent: engine.id }))
    if (Result.isFailure(outcome)) return outcome.failure.message
    agentReadings()?.visit(node)
    unfold(node)
  }
  const bound = roster.at(node)
  if (bound?.session == null) {
    // A bare row, or one naming only an engine: `Start an agent` — a choice of
    // every engine that can start on a bare row, the named engine alone on a
    // sessionless one, and nothing when none can.
    const engines = bound?.engine != null
      ? roster.engines().filter(engine => engine.id === bound.engine) : roster.engines()
    return [{
      id: "start-agent", label: "Start an agent", writes: true,
      choices: engines.map(engine => ({ id: `start-agent-${engine.id}`, label: engine.name, writes: true, run: startOn(engine) })),
    }, ...(openAbove === undefined ? [] : [openAbove])]
  }
  // A node already talking through a conversation: `Fresh start` — the node's
  // own engine first, a choice only where there is one — and CLOSE, releasing
  // the node's agent back to the unclaimed chats (the conversation is filed
  // back under Chats by the next filer run).
  const available = roster.engines()
  const current = available.find(engine => engine.id === bound.engine)
  const engines = current === undefined ? available : [current, ...available.filter(engine => engine !== current)]
  return [
    ...(openAbove === undefined ? [] : [openAbove]),
    {
      id: "fresh-start", label: "Fresh start", writes: true,
      choices: engines.map(engine => ({
        id: `fresh-start-${engine.id}`, label: engine.name, writes: true,
        confirm: freshStartQuestion(bound.title), run: startOn(engine),
      })),
    },
    // THE OPT-IN, AND THE LABEL IS THE INDICATOR: nothing is tidied on its own
    // until somebody says so for a chat, and this is where they say it. `sleeps`
    // is the roster's answer, joined onto the row this menu hangs off, so the
    // label says which way the press will go without a second reading — and the
    // mark is a property a person can also type in the drawer.
    {
      id: "sleep-when-idle", writes: true,
      label: bound.sleeps ? "Stop sleeping when idle" : "Sleep when idle",
      run: async (node: string) => {
        const outcome = await runAsync(
          chatWire().procedures.conversation.setSleeping({ node, on: !bound.sleeps }),
        )
        if (Result.isFailure(outcome)) return outcome.failure.message
      },
    },
    ...chatVerbs(bound),
  ]
}

/**
 * THE SEAT, GIVEN BACK BY HAND. olai closes an idle chat's seat on its own
 * after two days, and takes the oldest quiet one when a ninth agent is
 * started — this is the same close with a person's hand on it, for the case
 * neither of those covers: eight agents all busy, and the one a person has
 * finished with is the one they know about (`../scoped.ts`'s `Chat.sleep`).
 * The binding stays, so the row stays and opening it continues the chat.
 */
const PUT_TO_SLEEP: RowVerb = {
  id: "put-to-sleep", writes: false, label: "Put to sleep",
  run: async (node: string) => {
    const outcome = await runAsync(chatWire().procedures.conversation.sleep({ node }))
    if (Result.isFailure(outcome)) return outcome.failure.message
  },
}

/**
 * THE PASS, ASKED FOR BY HAND. A node agent's memory is tidied on olai's own
 * clock (`../sleep.ts` argues the spans), and this is the same pass with a
 * person's hand on it: the idle window and the "memory has moved" test are
 * the loop's way of deciding a node is DUE, and somebody pressing this has
 * decided. What comes back is either nothing or the sentence saying why it
 * could not begin — another pass is running, or `sleep` is off here
 * (`../wire.ts`'s `tidyMemory`).
 */
const TIDY_MEMORY: RowVerb = {
  id: "tidy-memory", writes: true, label: "Tidy memory",
  run: async (node: string) => {
    const outcome = await runAsync(chatWire().procedures.conversation.tidyMemory({ node }))
    if (Result.isFailure(outcome)) return outcome.failure.message
    return outcome.success._tag === "Refused" ? outcome.success.said : undefined
  },
}

const CLOSE_AGENT: RowVerb = {
  id: "close-agent", writes: true, label: "Close the agent",
  run: async (node: string) => {
    const outcome = await runAsync(chatWire().procedures.conversation.closeAgent({ node }))
    if (Result.isFailure(outcome)) return outcome.failure.message
    fold(node)
  },
}

/** The two answers {@link chatVerbs} has, and the empty one — VALUES, so the
 *  same row asked twice is handed the same array and the same objects. */
const SEATED: ReadonlyArray<RowVerb> = [PUT_TO_SLEEP, TIDY_MEMORY, CLOSE_AGENT]
const UNSEATED: ReadonlyArray<RowVerb> = [TIDY_MEMORY, CLOSE_AGENT]
const NO_CHAT: ReadonlyArray<RowVerb> = []

/**
 * THE VERBS ABOUT A CHAT THAT EXISTS, in one place because they are drawn in
 * three: a node's `•••` on the outline, a Chats row's `•••` in the sidebar
 * (`./agents/ChatRowMenu.tsx`) and ⌘K (`./agents/AgentPalette.ts`). The words,
 * the presses and the rule about which rows get which are decided HERE — a
 * second copy anywhere is how one of them ends up saying something the others
 * do not, which is exactly what *Sleep now* did before it was *Tidy memory*.
 *
 * EVERY ENTRY IS A VERB THAT CAN WORK, which is one rule read twice. A row
 * naming no conversation has NONE of these — `Tidy memory` and `Close the
 * agent` are both about a chat, and a sidebar row may be a bare node (the
 * outline's menu never reaches here for one, so only the column had to ask).
 * `Put to sleep` is narrower still: it hands a SEAT back, so it is offered
 * exactly where there is one to hand back ({@link seated}) — which includes
 * the stopped agent whose dot the column does not draw. That row is the one
 * where it costs least of all: nothing is running, nothing is reaping it on
 * its own, and the seat is held until somebody says otherwise.
 *
 * A VERB CLOSES OVER NOTHING — the node it acts on is its argument — so these
 * are three constants and this function is a choice between two of them. What
 * that buys a caller is identity: a menu redrawn on a roster frame is handed
 * the objects it already had (`./agents/ChatRowPanel.tsx` keys on them).
 */
export const chatVerbs = (bound: Row): ReadonlyArray<RowVerb> =>
  bound.session == null ? NO_CHAT : seated(bound.standing) ? SEATED : UNSEATED
