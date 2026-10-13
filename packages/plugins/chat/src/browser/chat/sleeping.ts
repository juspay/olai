/**
 * THE OPT-IN'S TWO PURE QUESTIONS — which roster row a conversation is, and what
 * the switch beside it says.
 *
 * A PLAIN MODULE BESIDE THE COMPONENT rather than exports of it, because
 * `bun test` resolves SolidJS's server build (`justfile` says so where the
 * browser tests are counted) and a test that imported a `.tsx` for a predicate
 * would be pulling a renderer in to ask a question about an array.
 */

import type { NodeAgentRow } from "../../wire.ts"

/** WHICH ROW OF THE AGENTS ROSTER THIS CONVERSATION IS, or `undefined` — the
 *  node agent whose engine and conversation are the ones on screen.
 *
 *  A PLAIN CHAT HAS NO SUCH ROW, and that is the whole gate: a conversation
 *  nobody is seated on has no node to mark, so it gets no switch. Read off the
 *  agents reading the browser already holds — the rows `AgentPalette.ts` finds
 *  the shown conversation among — never by walking the vault from here.
 */
export const nodeAgentOf = (
  rows: ReadonlyArray<NodeAgentRow>,
  to: { readonly agent: string; readonly session: string } | undefined,
): NodeAgentRow | undefined =>
  to === undefined
    ? undefined
    : rows.find((row) => row.engine === to.agent && row.session === to.session)

/** THE SWITCH'S WORDS: `aria-checked` is the mark itself, and this is what a
 *  person reads beside it. */
export const sleepWords = (sleeps: boolean): "On" | "Off" => sleeps ? "On" : "Off"
