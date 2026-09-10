/**
 * THE NODE-AGENT DOOR'S REMAINING RULE.
 *
 * The subtree is not the agent's territory. It is the session's home — where
 * its charter is, where its history is kept, where its doorbells ring. What
 * the agent may act on is the vault, the same as a person at the panel or a
 * coding agent on the loopback door. So there is no write fence, and this
 * module is not one.
 *
 * TWO INHABITANTS, and neither of them is a place:
 *
 *   - a released ticket is closed, never widened;
 *   - an open session, with the keys it may not write, each with the clause
 *     that says why.
 *
 * Absence of a rule is absence: a panel keystroke and loopback MCP pass no
 * third argument to `run`. The forbidden table is a MAP AND NOT A SET for the
 * reason it always was: the two words are forbidden for different reasons —
 * one is a conversation's binding, the other is a person's approval of code —
 * and the sentence that explains each one travels from whoever forbade it,
 * from the plugin that owns the word, rather than being composed in this
 * general package.
 */
import {
  changesOf,
  customText,
  type Derived,
  isMirror,
  type Node,
  nodesOf,
  type Writer,
} from "@olai/format"

import type { Plan } from "./plan.ts"

export type SessionRule =
  | { readonly _tag: "closed" }
  | { readonly _tag: "open"; readonly forbidden: ReadonlyMap<string, string> }

export interface Caller {
  readonly writer: Writer
  /** Absent is loopback MCP or the panel: the ordinary write face. */
  readonly rule?: SessionRule
}

export type Barred =
  | { readonly why: "closed" }
  | {
    readonly why: "key"
    readonly id: string
    readonly title: string
    readonly key: string
    /** The clause the open rule carried for this key. */
    readonly says: string
  }

export const doorRefusal = (reached: Barred): string => {
  if (reached.why === "closed") {
    return "this conversation has been reaped, so the door it was handed is closed and nothing may be written through it."
  }
  // THE CLAUSE IS THE RULE'S, carried on the ticket beside the key it is
  // about. It used to be written in `./refusals.ts`, in a drawer of shared
  // "no"s, about a word a plugin owns; a second forbidden key — one that is
  // a person's approval of code rather than a conversation's binding — is
  // what made that one sentence untrue of half its subjects.
  return `\`${reached.key}\` is a property this door may not write — ${reached.says}, on “${reached.title}” (\`${reached.id}\`) as anywhere else.`
}

/** Judge the records a plan actually changes for the keys an open session
 *  may not write. Closed is refused at `run` without a plan walk. */
export const barred = (
  forbidden: ReadonlyMap<string, string>,
  derived: Derived,
  plan: Plan,
): Extract<Barred, { why: "key" }> | null => {
  if (forbidden.size === 0) return null

  const was = new Map(
    plan.files.map((one) => [one.file, nodesOf(derived, one.file).map((at) => at.node)]),
  )
  const now = new Map(plan.files.map((one) => [one.file, one.nodes]))
  const planned = new Map<string, Node>()
  for (const nodes of now.values()) {
    for (const node of nodes) planned.set(node.id, node)
  }

  for (const change of changesOf(was, now)) {
    const before = derived.byId.get(change.id)
    const after = planned.get(change.id)
    for (const [key, says] of forbidden) {
      // BOTH DIRECTIONS, which is the comparison rather than a policy: a value
      // that moved is a value this door wrote, and taking one off is writing it
      // as much as putting one on. Un-approving is the fail-safe direction and
      // would be defensible to allow; it is not a capability anything asks for,
      // and an asymmetric rule here would be one more thing a reader of the
      // rule has to hold.
      if (keyed(before?.node, key) !== keyed(after, key)) {
        return { why: "key", id: change.id, title: change.title, key, says }
      }
    }
  }
  return null
}

const keyed = (node: Node | undefined, key: string): string | undefined =>
  node === undefined || isMirror(node) ? undefined : customText(node, key)
