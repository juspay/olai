/**
 * THE TWO VERBS ON A ROW'S `•••`, AND THE PALETTE'S `>` — chat's contributions
 * to two places in the app that used to spell it themselves.
 *
 * ## What they were
 *
 * `@olai/web`'s `menu/verbs.ts` carried `ask-agent` and `start-agent` in core's
 * own catalogue, and its `menu/actions.ts` carried the arms that ran them: one
 * armed the composer with the row's node, the other opened a session and bound
 * the node to it. The catalogue took an `engines` list as a parameter, threaded
 * from the roster context down through the tree, so that a row could offer one
 * entry per installed ACP engine. `palette/Palette.tsx` carried a `>` prefix
 * whose whole action was `chat.send`.
 *
 * All of it is here now. What core keeps is the BOX — the menu's order, its
 * dividers and where a plugin's verbs sit relative to its own reads and writes;
 * the palette's input, its prefix strip and where a refusal is drawn — and what
 * this file brings is the words and the press.
 *
 * ## ONE REGISTRATION PER ENGINE, rather than a submenu
 *
 * `outline.row.action` is a flat list of `{id, label, run}` and has no submenu,
 * and that is not a limitation this file works around: the old catalogue built
 * one FLAT entry per choice too, with the engine's name in the label only when
 * there was a choice to make. So the shape is unchanged; what moved is who
 * decides how many there are. The engines are read off this plugin's OWN chat
 * cell, which is where the server already sends them per installed agent — one
 * authored source for a name, which is the same argument the `engine.install`
 * slot's absence of a picker face makes.
 *
 * ## THE PANEL IS OPENED BY BOTH, and for one reason
 *
 * A chip in a panel nobody can see is a gesture that did nothing, and a
 * conversation switched behind a shut drawer is a press that looks like it
 * failed. The panel is where the answer to "what did that do" is, so opening it
 * is part of each verb rather than a nicety. The open state is the SHELL's — the
 * seat's geometry and its preference stay `@olai/web`'s, which is what the
 * `app.panel` slot hands over — so this reaches for it through the shell door
 * like any other face that draws inside the app.
 */

import type { AppCommand, RowAction } from "@olai/plugin-api"
import { setPanelOpen } from "@olai/web/client/layout/prefs.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { Result } from "effect"
import { onCleanup, type JSX } from "solid-js"

import { useAgents } from "./agents/answered.tsx"
import { armNode, releaseArmed, restoreArmed } from "./chat/armed.ts"
import { createChatState } from "./chat/state.ts"
import { chatWire } from "./wire.ts"

let commandState: ReturnType<typeof createChatState> | null = null

/** Palette commands are imperative slot values. Keep their conversation
 * reading in the app's mounted lifetime, including while the drawer is shut. */
export function CommandContext(props: { readonly children: JSX.Element }) {
  const state = createChatState()
  commandState = state
  onCleanup(() => { if (commandState === state) commandState = null })
  return props.children
}

/**
 * WHAT A ROW'S `•••` OFFERS, READ AT THE WALK.
 *
 * A FUNCTION and not a list, and the slot's own type says so — because the
 * second verb's COUNT depends on what this machine has, and that is not knowable
 * when this plugin's `apply` runs. A serve with three engines offers three rows,
 * one with none offers none (there is nothing to start a session with, and an
 * entry whose only outcome is that sentence teaches nobody anything), and the
 * roster arrives over a wire the tab dials AFTER the fiber that registers this.
 *
 * THE SUBSCRIPTION IS THE MENU'S, and that is what makes this safe to call per
 * walk: `createChatState` binds inside whatever owner is drawing, and the app
 * reads this slot inside its own tracked memo — so the list is re-derived when
 * the cell moves, and disposed with the menu that asked. Calling it once at
 * `apply` would have bound a computation to no owner at all and frozen the
 * answer at "no engines", which is what every machine looks like before its
 * first roster frame.
 */
export const rowVerbs = (node: string): ReadonlyArray<RowAction> => {
  const state = createChatState()
  // WHAT THIS ROW IS ALREADY TALKING THROUGH, off the roster this half
  // subscribes to once for the whole tab (`./agents/answered.tsx`). It is the
  // ROSTER rather than the record's own property, and the two agree by
  // construction: the roster IS the query over that property, answered where the
  // set is, so a row that is on it is a row that carries one.
  const bound = useAgents().at(node)
  const verbs: Array<RowAction> = [{
    // THE COMPOSER, ARMED WITH THIS NODE — a READ, and it writes nothing at
    // all. What happens to the node afterwards is whatever is typed next,
    // through the same tools and the same gate as always.
    //
    // The NODE the row shows rather than the record standing there: a mirror is
    // a placement, it has no title of its own, and the thing to ask about is
    // what it is a placement OF. The slot hands over exactly that id, which is
    // core's own arithmetic over mirrors and folds spent before the press —
    // so a plugin cannot get that distinction wrong by not knowing it exists.
    id: "ask-agent",
    label: "Ask agent",
    // A READ, so it sits with core's — above the rule, where a press that
    // changes what this tab is pointed at belongs. What happens to the node
    // afterwards is whatever is typed next, through the same tools and the same
    // gate as always.
    writes: false,
    run: (node) => {
      armNode(node)
      setPanelOpen(true)
    },
  }]
  /**
   * WHICH ENGINES THIS ROW MAY BE STARTED ON — three answers, and the third is
   * the one a flat list of every engine gets wrong.
   *
   * A row ALREADY TALKING through a conversation is offered none, and NOT
   * because the server would refuse it: `startAgentSession` on a bound node is
   * exactly the *fresh session* gesture ({@link ../wire.ts}) and lands. It is
   * withheld because of what it COSTS — the transcript becomes history — and a
   * menu line is not where that sentence fits. The panel's own session picker
   * is where it is offered, under the words that make it safe to press
   * ({@link ./chat/NodeSessions.tsx}), and the panel draws that picker wherever
   * it knows the node — a refused open included, which is the one place a
   * person can be stuck. A row that NAMES an engine and has no session yet is
   * offered that engine and no other, because the choice was already made and
   * re-asking it is a way to point a node at two. A BARE row is offered every
   * engine this machine has, which is the ordinary case and the one that
   * CREATES a node agent.
   */
  const engines = bound?.session != null
    ? []
    : bound?.engine != null
    ? state().roster.filter((one) => one.id === bound.engine)
    : state().roster
  for (const engine of engines) {
    verbs.push({
      id: `start-agent-${engine.id}`,
      // ...and this one WRITES: it names the conversation on the node, which is
      // a property in the directory, so it sits below the rule with core's own
      // writes.
      writes: true,
      // The label carries the agent's name only when there is a CHOICE to make.
      // Naming it on a machine with one agent, or on a row whose engine is
      // already decided, would be answering a question nobody was asked, in the
      // one place a menu has no room for it.
      label: engines.length === 1
        ? "Start an agent session"
        : `Start an agent session — ${engine.name}`,
      // THROUGH THE APP'S ONE EDGE, and not awaited directly: a procedure on a
      // surface client is an EFFECT, so `await`ing it resolves the DESCRIPTION
      // and runs nothing at all — the panel opened, the menu closed, and the
      // property was never written. `runAsync` is where this app runs one, and
      // it is not a convenience: it is what holds the tab's quiescence open for
      // the length of the call, which is what a scenario waits on.
      run: async (node) => {
        const outcome = await runAsync(
          chatWire().procedures.conversation.startAgentSession({ node, agent: engine.id }),
        )
        if (Result.isFailure(outcome)) return outcome.failure.message
      },
    })
  }
  return verbs
}

/**
 * `>` SENDS, AND IT SENDS WHAT THE COMPOSER IS HOLDING AS WELL.
 *
 * This is the second door to one message. A node armed from a row
 * ({@link ./chat/armed.ts}) is part of the message being written, not part of
 * the box it is being written in — so a send from here that ignored the strip
 * would ask the agent a question with the subject left off, and leave the chip
 * sitting in a composer whose message has already gone.
 *
 * It follows the composer's own order for the same reason
 * ({@link ./chat/Composer.tsx}): release before the call, and put back what a
 * refusal threw away — into a strip nobody has armed since, so a row armed while
 * the answer was in flight wins over the one being restored.
 *
 * THE PANEL IS OPENED EITHER WAY. On a send that landed it is where the answer
 * appears; on one that was refused it is the other place a reader can recover,
 * and the palette draws the refusal where it draws every other one.
 */
export const askCommand: AppCommand = {
  prefix: ">",
  said: "ask the agent",
  placeholder: "ask the agent…",
  run: async (line) => {
    const context = releaseArmed()
    // THROUGH THE APP'S ONE EDGE — see the note on the menu verb above. It is
    // also what turns a refusal into a VALUE rather than a rejection:
    // `runAsync` answers a `Result`, so there is no throw here to catch and no
    // way for one of the three exits to escape unread.
    const outcome = await runAsync(
      chatWire().procedures.conversation.send({ scope: commandState?.().uploadScope ?? null, text: line, context }),
    )
    setPanelOpen(true)
    if (Result.isSuccess(outcome)) return null
    restoreArmed(context)
    // THE PLUGIN'S OWN WORDS, which for a refused send are the server's: every
    // way this call is turned down is an `OpFailure` carrying a sentence
    // somebody wrote for a person to read, and composing anything around it here
    // would be core's template with a noun dropped in.
    return outcome.failure.message
  },
}
