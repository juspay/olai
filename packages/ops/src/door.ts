/**
 * THE NODE-AGENT DOOR'S REMAINING RULE.
 *
 * The subtree is not the agent's territory. It is the session's home — where
 * its charter is, where its history is kept, where its doorbells ring. What
 * the agent may act on is the vault, the same as a person at the panel or a
 * coding agent on the loopback door. So there is no write fence, and this
 * module is not one.
 *
 * TWO THINGS THIS DOOR STILL REFUSES, and neither of them is a place:
 *
 *   - a released ticket is closed, never widened;
 *   - the keys on {@link Door.forbidden}, each with the clause that says why.
 *
 * The forbidden table is a MAP AND NOT A SET for the reason it always was:
 * the two words are forbidden for different reasons — one is a conversation's
 * binding, the other is a person's approval of code — and the sentence that
 * explains each one travels from whoever forbade it, from the plugin that
 * owns the word, rather than being composed in this general package.
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

export interface Door {
  /** True once the session is reaped — closed, never widened. */
  readonly closed: boolean
  /**
   * THE KEYS THIS DOOR MAY NOT WRITE, each with the clause that says why.
   *
   * A MAP AND NOT A SET, and the value is prose. It was a set while there was
   * one key, and the sentence that explained it was written HERE, in a general
   * package, about a word `olai-plugin-chat` owns (*it is what seats a
   * conversation on a node*) — which is this tree's own rule broken quietly:
   * failure prose is the owner's, and core carries it.
   *
   * A second key made that visible rather than merely true. The two forbidden
   * words are forbidden for different reasons, and one sentence cannot be about
   * both. So the reason travels with the key, from whoever forbade it, and
   * `./refusals.ts` spends it instead of composing one.
   */
  readonly forbidden: ReadonlyMap<string, string>
}

export interface Caller {
  readonly writer: Writer
  /** Null is loopback MCP or the panel: the same write door, no property rule. */
  readonly door: Door | null
}

export type Barred =
  | { readonly why: "closed" }
  | {
    readonly why: "key"
    readonly id: string
    readonly title: string
    readonly key: string
    /** The clause the door carried for this key — see {@link Door.forbidden}. */
    readonly says: string
  }

/** Judge the records a plan actually changes for the keys this door may not
 *  write. File and document operations are ordinary writes. */
export const barred = (
  door: Door,
  derived: Derived,
  plan: Plan,
): Barred | null => {
  if (door.closed) return { why: "closed" }
  if (door.forbidden.size === 0) return null

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
    for (const [key, says] of door.forbidden) {
      // BOTH DIRECTIONS, which is the comparison rather than a policy: a value
      // that moved is a value this door wrote, and taking one off is writing it
      // as much as putting one on. Un-approving is the fail-safe direction and
      // would be defensible to allow; it is not a capability anything asks for,
      // and an asymmetric rule here would be one more thing a reader of the
      // door has to hold.
      if (keyed(before?.node, key) !== keyed(after, key)) {
        return { why: "key", id: change.id, title: change.title, key, says }
      }
    }
  }
  return null
}

const keyed = (node: Node | undefined, key: string): string | undefined =>
  node === undefined || isMirror(node) ? undefined : customText(node, key)
