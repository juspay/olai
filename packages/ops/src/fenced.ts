/**
 * THE SUBTREE WRITE FENCE — asked once per write, between the plan and the gate.
 *
 * A node agent writes at or under the node it is the agent for, and asks
 * somebody above it for anything else. This module is the enforcement half of
 * that sentence; the teaching half is the agent's standing prompt, and an agent
 * told the rule writes better than one refused by it.
 *
 * ## PER RECORD, and that is the whole design
 *
 * A `FilePlan` is "one outline, as the records it will hold after the write"
 * ({@link ./plan.ts}) and {@link ./ops.ts} serialises each one WHOLE. An agent
 * whose node lives in `house.olai` therefore rewrites every record in
 * `house.olai` on every `set_done` inside its own subtree — legitimately. A
 * fence over the plan's PATHS would either forbid that or permit everything in
 * the file, and both of those are worse than no fence at all. So the question is
 * asked of the DIFF, which is the same reading {@link ./sorted.ts} already takes
 * on the success path: `changesOf` over what the files hold now and what the
 * plan says they will hold.
 *
 * ## ...AND OF THE PLAN'S SHAPE, because one write is invisible to a diff
 *
 * `create_outline` with no seed mints an empty `.olai`, which "compares as
 * nothing at all" — {@link ./sorted.ts} says so in its own words, and has to,
 * because that is why the sort has a file arm. A per-record fence therefore
 * passes the sharpest file-shaped write VACUOUSLY. So three lines below ask the
 * PLAN instead of the diff, and they ask its shape rather than the op's name: a
 * table keyed on `request.op` is a table somebody has to edit when a
 * twenty-fifth planner arrives, and it would need its own entry for
 * `empty_trash` besides. Three shapes catch five verbs and generalise.
 *
 * ## IT KNOWS NOTHING ABOUT NODE AGENTS
 *
 * The words a refusal names an ancestor with, and the keys a door may not write,
 * arrive as DATA — the way the kind vocabulary arrives. What seats a
 * conversation on a node is a word a PLUGIN contributes, and a fence that had to
 * know that word would be this layer learning what a conversation is. Two
 * strings are compared here and the caller owns both of them.
 *
 * ## WHAT IT IS NOT
 *
 * It is a WRITE fence: reads are untouched, and an agent sees the whole vault
 * (which is what makes "ask the node above you" a thing it can even phrase). It
 * is also not a sandbox — it contains an agent that follows the protocol it was
 * handed, and `../server`'s `route.ts` documents the loopback door that is
 * deliberately left open beside it.
 */

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

/** A DOOR NARROWED TO ONE SUBTREE. */
export interface Fence {
  /** The node this door writes AT OR UNDER, or `null` for a door that has been
   *  CLOSED — the credential of a session that was reaped.
   *
   *  A closed door rather than an absent one, because the alternative is the
   *  wrong direction for reaping to move anything: forgetting a released
   *  credential would WIDEN what a stale one can do. */
  readonly under: string | null
  /** How a refusal names the nearest node agent above, or `null` where the only
   *  thing above is a person.
   *
   *  A THUNK, spent only on the refusal path, because who is above a node moves
   *  with the vault — and because "which node above is an agent" is a reading of
   *  a word a plugin contributed, which this layer cannot and should not
   *  perform. */
  readonly ask: () => string | null
  /** Property keys this door may not write ANYWHERE, its own node included.
   *
   *  The one refusal here that is not a question about PLACE, and it is the
   *  reason the fence can be "at or under" rather than "strictly under" without
   *  giving anything away: a door that could write the word that seats a
   *  conversation could rebind itself onto another node, unbind itself out of
   *  the roster, or seat a sub-agent on a node strictly inside its own subtree.
   *  Forbidding the key closes all three at once, everywhere, and teaches this
   *  module nothing about what the key means. */
  readonly forbidden: ReadonlySet<string>
}

/**
 * WHO IS WRITING AND HOW FAR THEY REACH — both halves in one record, so a face
 * cannot compose one and forget the other.
 *
 * `null` is a WORD — "nothing that reaches this face is fenced" — and never an
 * omission. `@olai/ops`' own `run` takes the fence OPTIONALLY, because most of
 * its doors genuinely have no session behind them (a keystroke, the undo derived
 * from it, a plugin's property write, a repeat roll). A FACE is the other case:
 * `@olai/server`'s `writing`, `writerAt` and `runResolved` take this record with
 * `fence` required and no default, which is where a forgotten fence is a compile
 * error rather than a silently unfenced agent.
 */
export interface Caller {
  readonly writer: Writer
  readonly fence: Fence | null
}

/** WHAT THE WRITE REACHED FOR THAT IT MAY NOT HAVE — the six shapes, each
 *  carrying exactly what the sentence about it names ({@link
 *  ./refusals.ts}'s `fenceRefusal`). */
export type Outside =
  | { readonly why: "closed" }
  | { readonly why: "seat" }
  | {
    readonly why: "record"
    readonly id: string
    readonly title: string
    readonly file: string
  }
  | { readonly why: "file"; readonly path: string }
  | { readonly why: "document"; readonly path: string }
  | {
    readonly why: "key"
    readonly id: string
    readonly title: string
    readonly key: string
  }

/**
 * Whether this plan reaches outside the fence, and what it reached for —
 * `null` for a plan entirely inside it.
 *
 * PURE, and asked of a plan rather than of a request: everything it needs is a
 * reading and a plan, both of which the write loop is holding at the one moment
 * they are both true of each other.
 */
export const outsideFence = (
  fence: Fence,
  derived: Derived,
  /** Which outlines the set already serves — `outlineNames(snapshot.value.set)`. */
  served: ReadonlySet<string>,
  /** This vault's inbox, or `undefined` where it keeps none —
   *  `inboxIn(outlinePaths(snapshot.value.set))`. */
  inbox: string | undefined,
  plan: Plan,
): Outside | null => {
  const under = fence.under
  if (under === null) return { why: "closed" }
  // THE SEAT. The node this door is the agent for was deleted, or put away
  // under it: every write it could make is above nothing, and saying so is
  // kinder than refusing each write in turn as "not inside your subtree" while
  // the subtree does not exist. A PLACEMENT is the same answer — a mirror is a
  // second showing of a node and not a node, so nothing can be seated on one,
  // and `insideSubtree` would say `false` about every record beneath it anyway.
  const seat = derived.byId.get(under)
  if (seat === undefined || isMirror(seat.node)) return { why: "seat" }

  // A FILE IS A VAULT-SHAPED DECISION and is inside nobody's subtree. Asked of
  // the plan's shape rather than of the verb: `plan.documents` carries no node
  // id, `plan.removed` is a bare path list, and a minted outline holds no
  // records at all — so none of the three is visible to the record rule below.
  const removed = plan.removed ?? []
  if (removed.length > 0) return { why: "file", path: removed[0] as string }
  const documents = plan.documents ?? []
  if (documents.length > 0) {
    return { why: "document", path: (documents[0] as { readonly file: string }).file }
  }
  /**
   * WHERE A CAPTURE LANDS IN THIS VAULT — the inbox it keeps, or the one
   * `captureInto` mints for a vault that keeps none (`@olai/format`'s
   * `inbox.ts`, which is where that fork is decided and the only place it is).
   *
   * ONE expression, spent twice below: as the one file a fenced door may bring
   * into being, and as the one file an ARRIVAL may land in from outside the
   * fence. It has to be the same one — a mint that layer 2 permitted and layer
   * 3 then refused as a record outside the subtree would let no capture through
   * at all in a vault with no inbox, which is precisely the vault where a
   * capture is the agent's only way to say something upward.
   *
   * Capture is the deliberate hole in this fence, and the carve-out is the
   * PLACE rather than the verb: `capture` never reaches this layer as an op at
   * all. A capture cannot say where it goes, so it cannot name a place above
   * anybody, and `captured-by` records which door filed it. Until the
   * ancestor-ask channel exists, that is how an agent that notices something
   * above its remit puts a line where a person reads it.
   */
  const filing = inbox ?? mintedInto(INBOX)
  for (const one of plan.files) {
    if (!served.has(one.file) && one.file !== filing) return { why: "file", path: one.file }
  }

  const was = new Map<string, ReadonlyArray<Node>>(
    plan.files.map((one) => [one.file, nodesOf(derived, one.file).map((at) => at.node)]),
  )
  const now = new Map(plan.files.map((one) => [one.file, one.nodes]))
  /** The plan's own records as an index this package can climb — the after side
   *  of the same walk `insideSubtree` takes on the before side. `line` is the
   *  record's position in the file it is planned into, which is what an outline
   *  writes it at; nothing here reads it, and inventing a different number would
   *  be the lie. */
  const planned = new Map<string, Located>()
  for (const [file, nodes] of now) {
    nodes.forEach((node, at) => planned.set(node.id, { file, line: at + 1, node }))
  }

  for (const change of changesOf(was, now)) {
    const before = derived.byId.get(change.id)
    const after = planned.get(change.id)

    // THE BEFORE SIDE, with NO put-away exemption — and that one omission is
    // what refuses `untrash_node` and `empty_trash` with no table entry for
    // either: a record in the trash has an ancestry inside the trash, so it is
    // outside every fence, and a record already put away has no live side left
    // to prove ownership with. The cost is stated rather than hidden: an agent
    // cannot undo its own trash, and a person can. Permitting the undo would
    // let a fenced agent pull ANYBODY's trashed record into its own subtree,
    // which is a write to somebody else's record with extra steps.
    if (before !== undefined && !insideSubtree(derived, change.id, under)) {
      return reached(change)
    }

    if (after !== undefined) {
      // PUTTING A NODE AWAY is the only way to take one out of a subtree, and
      // it necessarily writes a file that is under no node at all. So a side in
      // the trash is EXEMPT and the change is judged by the other side alone:
      // an agent may put its own records away, and may not put anybody else's.
      const away = isPutAway(after.file)
      // ...and the INBOX is fence-neutral for ARRIVALS — see `filing` above.
      // Keyed on the FILE and not on the verb, because `capture` never reaches
      // this layer as an op at all ({@link ./tools.ts} resolves it to
      // `add`/`create` through `captureInto`), so a name-keyed carve-out would
      // never have fired. EDITING an existing inbox record is fenced by the
      // before side above, which is what keeps this an outbox and not a hole.
      const filed = after.file === filing && change.sort === "created"
      if (!away && !filed) {
        // THE SAME WALK, a different index. `parent` is same-file by the format
        // and a `FilePlan` is the whole file, so a chain that reaches the
        // fence's node reaches it inside the plan's own records: this climb
        // never leaves them, and there is no fallback to `derived` because
        // there is nothing for one to answer.
        //
        // A SET WHERE A CHILD SITS IN ANOTHER FILE FROM ITS PARENT is a set the
        // validator condemns, and this refuses the write rather than reaching
        // into the derivation to complete the chain. That is the conservative
        // arm and the right one: the fence would be asking about a hierarchy
        // nothing may publish, and the sentence a person gets ("not inside your
        // subtree") is truer than one derived from a crumb the plan is not
        // writing.
        const chain = ancestryOver((id) => planned.get(id), change.id)
        if (change.id !== under && !chain.some((crumb) => crumb.node.id === under)) {
          return reached(change)
        }
      }
    }

    // THE ONE KEYED REFUSAL, and it is not a question about place — see
    // {@link Fence.forbidden}. Two strings compared; what the key MEANS is the
    // caller's business and stays there.
    for (const key of fence.forbidden) {
      const then = keyed(before?.node, key)
      const next = keyed(after?.node, key)
      if (then !== next) {
        return { why: "key", id: change.id, title: change.title, key }
      }
    }
  }

  return null
}

/** What one side of a change says under a key — `undefined` for a side that is
 *  not there, and for a PLACEMENT, which carries no properties at all: a mirror
 *  is where a node is shown and the record it shows is where its facts live. */
const keyed = (node: Node | undefined, key: string): string | undefined =>
  node === undefined || isMirror(node) ? undefined : customText(node, key)

const reached = (change: NodeChange): Outside => ({
  why: "record",
  id: change.id,
  title: change.title,
  file: change.file,
})
