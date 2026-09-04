/** A write door narrowed to one node subtree. */
import {
  ancestryOver,
  changesOf,
  customText,
  type Derived,
  INBOX,
  insideSubtree,
  isMirror,
  isPutAway,
  type Located,
  mintedInto,
  type Node,
  type NodeChange,
  nodesOf,
  type Writer,
} from "@olai/format"

import type { Plan } from "./plan.ts"

export interface Fence {
  /** Null is a released session ticket: closed, never widened. */
  readonly under: string | null
  readonly ask: () => string | null
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
   * words are forbidden for different reasons — one is a conversation's binding,
   * the other is a person's approval of code — and one sentence cannot be about
   * both. So the reason travels with the key, from whoever forbade it, and
   * `./refusals.ts` spends it instead of composing one.
   */
  readonly forbidden: ReadonlyMap<string, string>
}

export interface Caller {
  readonly writer: Writer
  readonly fence: Fence | null
}

export type Outside =
  | { readonly why: "closed" }
  | { readonly why: "seat" }
  | { readonly why: "record"; readonly id: string; readonly title: string; readonly file: string }
  | { readonly why: "file"; readonly path: string }
  | { readonly why: "document"; readonly path: string }
  | {
    readonly why: "key"
    readonly id: string
    readonly title: string
    readonly key: string
    /** The clause the fence carried for this key — see {@link Fence.forbidden}. */
    readonly says: string
  }

/** Judge the records a plan actually changes, plus the file-shaped operations
 * that a record diff cannot see. */
export const outsideFence = (
  fence: Fence,
  derived: Derived,
  served: ReadonlySet<string>,
  inbox: string | undefined,
  plan: Plan,
): Outside | null => {
  const under = fence.under
  if (under === null) return { why: "closed" }
  const seat = derived.byId.get(under)
  if (seat === undefined || isMirror(seat.node)) return { why: "seat" }

  const removed = plan.removed ?? []
  if (removed.length > 0) return { why: "file", path: removed[0] as string }
  const documents = plan.documents ?? []
  if (documents.length > 0) return { why: "document", path: documents[0]!.file }

  // Capture is the deliberate outbox: it chooses the vault's inbox itself and
  // records attribution, so the caller cannot use it to name an outside place.
  const filing = inbox ?? mintedInto(INBOX)
  for (const one of plan.files) {
    if (!served.has(one.file) && one.file !== filing) return { why: "file", path: one.file }
  }

  const was = new Map(
    plan.files.map((one) => [one.file, nodesOf(derived, one.file).map((at) => at.node)]),
  )
  const now = new Map(plan.files.map((one) => [one.file, one.nodes]))
  const planned = new Map<string, Located>()
  for (const [file, nodes] of now) {
    nodes.forEach((node, line) => planned.set(node.id, { file, line: line + 1, node }))
  }

  for (const change of changesOf(was, now)) {
    const before = derived.byId.get(change.id)
    const after = planned.get(change.id)
    if (before !== undefined && !insideSubtree(derived, change.id, under)) return reached(change)

    if (after !== undefined) {
      const filed = after.file === filing && change.sort === "created"
      if (!isPutAway(after.file) && !filed) {
        const chain = ancestryOver((id) => planned.get(id), change.id)
        if (change.id !== under && !chain.some((crumb) => crumb.node.id === under)) {
          return reached(change)
        }
      }
    }

    for (const [key, says] of fence.forbidden) {
      // BOTH DIRECTIONS, which is the comparison rather than a policy: a value
      // that moved is a value this door wrote, and taking one off is writing it
      // as much as putting one on. Un-approving is the fail-safe direction and
      // would be defensible to allow; it is not a capability anything asks for,
      // and an asymmetric rule here would be one more thing a reader of the
      // fence has to hold.
      if (keyed(before?.node, key) !== keyed(after?.node, key)) {
        return { why: "key", id: change.id, title: change.title, key, says }
      }
    }
  }
  return null
}

const keyed = (node: Node | undefined, key: string): string | undefined =>
  node === undefined || isMirror(node) ? undefined : customText(node, key)

const reached = (change: NodeChange): Outside => ({
  why: "record",
  id: change.id,
  title: change.title,
  file: change.file,
})
