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

export type ReservedKey = string | { readonly says: string; readonly file: string }

export type SessionRule =
  | { readonly _tag: "closed" }
  | { readonly _tag: "open"; readonly forbidden: ReadonlyMap<string, ReservedKey> }

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
  forbidden: ReadonlyMap<string, ReservedKey>,
  derived: Derived,
  plan: Plan,
  paths: ReadonlyArray<string> = [...derived.byFile.keys()],
): Extract<Barred, { why: "key" }> | null => {
  if (forbidden.size === 0) return null

  // File-scoped reservations compare the selected namespace as a whole. This
  // also refuses renames, moves, deletion and an empty shallower file masking
  // a deeper one; a property-only comparison would miss all four.
  for (const [key, reservation] of forbidden) {
    if (typeof reservation === "string") continue
    const before = new Map<string, ReadonlyArray<Node>>(paths.map((file) => [file, nodesOf(derived, file).map((one) => one.node)]))
    const after = new Map(before)
    for (const one of plan.documents ?? []) after.set(one.file, [])
    for (const one of plan.files) after.set(one.file, one.nodes)
    for (const file of plan.removed ?? []) after.delete(file)
    const claims = (files: ReadonlyMap<string, ReadonlyArray<Node>>) => {
      const file = [...files.keys()].filter((file) => file.split("/").pop()?.toLowerCase() === reservation.file.toLowerCase())
        .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0]
      if (file === undefined) return []
      const nodes = files.get(file) ?? []
      const protectedTitles = new Set(nodes.flatMap(node => !isMirror(node) && node.parent === undefined && keyed(node, key) !== undefined ? [node.title] : []))
      return nodes.flatMap(node => {
        const value = keyed(node, key)
        // A duplicate namespace without this key can become the selected row
        // and erase an existing choice. Its position is part of that choice.
        const shadow = !isMirror(node) && node.parent === undefined && protectedTitles.has(node.title)
        return value === undefined && !shadow ? [] : [{ id: node.id, title: isMirror(node) ? "" : node.title, parent: node.parent, ord: node.ord, value }]
      }).sort((a, b) => a.id.localeCompare(b.id))
    }
    const was = claims(before)
    const now = claims(after)
    if (JSON.stringify(was) !== JSON.stringify(now)) {
      const one = now.find((one) => !was.some((old) => JSON.stringify(old) === JSON.stringify(one))) ?? was[0]!
      return { why: "key", id: one.id, title: one.title, key, says: reservation.says }
    }
  }

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
      if (typeof says !== "string") continue
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
