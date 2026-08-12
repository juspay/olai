/**
 * What a keyboard — or a menu entry — MEANT, in terms of ops.
 *
 * The browser sends intents — "indent this", "toggle done", "a new sibling
 * after that", "this node is doing now" ({@link ../../surface/src/edit.ts}) —
 * and every one of them becomes exactly ONE {@link Request} for the ops layer
 * to plan. This file is that mapping and nothing else: it reads the snapshot,
 * works out the placement the intent implies, and hands back a request. It
 * writes nothing, touches no disk, and knows about no socket.
 *
 * WHY THE PLACEMENT IS DECIDED HERE and not in the tab that pressed the key:
 * "the node above this one" is a fact about the SET, and the set the write is
 * judged against is this one. A browser computing it would be a second reading
 * of the outline, some frames old, free to disagree with the one on disk — and
 * the disagreement would surface as a node landing under the wrong parent
 * rather than as a refusal. What crosses the wire is therefore the key that
 * was pressed, and the arithmetic stays where the truth is.
 *
 * PURE, over a {@link Reading}, for the reason `ops/plan.ts` is pure over a
 * snapshot: every case here is a question about siblings and marks, so it is
 * answerable with a value and testable without a server.
 *
 * WHAT IT MAY NOT DO is produce a request an agent could not have sent for the
 * same intent — "MCP and Web ops must be consistent; never deviate"
 * (HACKING.md). The two faces share one `ops.run`, so anything that reaches it
 * is judged identically; the risk is entirely HERE, in what this hands over.
 * The rule that falls out has two halves, and the difference between them is
 * who named the node:
 *
 *   - an id the CALLER named travels as it is. `toggle` on a mirror is refused
 *     by the ops layer, naming the node to use instead — and `set_done` on that
 *     same mirror is refused the same way. Resolving it here would make the
 *     keyboard succeed where the tool refuses, which is the deviation read
 *     backwards.
 *   - an id THIS FILE derives from the tree must be the one an agent would
 *     have named. "The row above" is such an id, and when that row is a mirror
 *     the node an agent would name as the new parent is the one it shows.
 *
 * The one thing it does NOT close over is the gap between reading and writing.
 * The snapshot can move between the read this resolves against and the commit
 * the ops layer makes, exactly as it can for an agent — and it ends the same
 * way: the request names NODES, so the write gate re-plans it against the
 * newer revision, and a placement whose anchor genuinely went away comes back
 * as a refusal naming it rather than as a guess.
 */

import {
  type Derived,
  isMirror,
  type Located,
  nodeNamed,
  type OpFailure,
  siblingsOf,
  UsageFailure,
} from "@olai/format"
import { notFound, type Reading, type Request } from "@olai/ops"
import type { Edit } from "@olai/surface"
import { Result } from "effect"

type Resolved = Result.Result<Request, OpFailure>

/** The ops request one keystroke asks for. Total over {@link Edit}: a verb
 *  added to the surface and not answered here is a compile error, which is the
 *  reason the union is declared beside the procedures rather than inferred
 *  from them. */
export const requestFor = (at: Reading, edit: Edit): Resolved => {
  switch (edit.verb) {
    case "add":
      return addRequest(at, edit)
    case "move":
      return moveRequest(at.derived, edit)
    case "toggle": {
      // The stored mark decides which way a toggle goes, and it is read here
      // rather than sent: a tab that had watched the row go done a moment ago
      // would ask for the mark it can already see, and the op would refuse
      // ("already done") for a key that was pressed to undo it.
      const undo = at.derived.status.get(edit.id) === edit.mark
      return Result.succeed({ op: edit.mark, id: edit.id, ...(undo ? { undo } : {}) })
    }
    case "mark":
      return markRequest(at.derived, edit)
    // The four that resolve nothing, and are spelled like the ops they are —
    // which is what makes the three above legible as the ones that do. Three
    // of them are the menu's: a date is a date, a placement is named by the
    // row it is, and a subtree is what `archive` has always taken.
    case "title":
      return Result.succeed({ op: "title", id: edit.id, title: edit.title })
    case "desc":
      return Result.succeed({ op: "desc", id: edit.id, desc: edit.desc })
    case "date":
      return Result.succeed({ op: "date", id: edit.id, date: edit.date })
    case "unmirror":
      return Result.succeed({ op: "unmirror", id: edit.id })
    case "archive":
      return Result.succeed({ op: "archive", id: edit.id })
  }
}

// ── the mark a menu names ──────────────────────────────────────────────

/**
 * A mark, put ON or taken OFF — the one menu verb with a question in it.
 *
 * Which op it becomes depends on what is being ASKED FOR rather than on what
 * is there: a mark named outright is that mark's own op, and "none" is the
 * stored mark's op with `undo`, because that is the only way the ops layer
 * spells taking one off. Those are the same two calls an agent makes, so every
 * refusal a person meets here is the ops layer's own — `already doing`, and
 * the one that matters most, `done. Undo that first — nothing should decide on
 * your behalf that finished work is not finished`. A menu that quietly sent
 * two ops to walk `done` back to `todo` would be the web doing in one gesture
 * what MCP needs two for, which is the deviation HACKING.md forbids: the
 * second click is the person's.
 *
 * The one refusal this file invents is for a node that carries nothing when a
 * menu asks for nothing. `Clear mark` is drawn only on a marked row, so
 * reaching it means the mark went while the panel was open — somebody else got
 * there first, which is a thing a person is owed a sentence about rather than
 * a silence.
 */
const markRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "mark" }>,
): Resolved => {
  const located = derived.byId.get(edit.id)
  if (located === undefined) return Result.fail(notFound(derived, edit.id))
  if (edit.mark !== null) return Result.succeed({ op: edit.mark, id: edit.id })
  const stored = derived.status.get(edit.id)
  if (stored === undefined) {
    return Result.fail(
      refusal(`\`${nameOf(located)}\` carries no mark, so there is none to take off`),
    )
  }
  return Result.succeed({ op: stored, id: edit.id, undo: true })
}

// ── a new row ──────────────────────────────────────────────────────────

const addRequest = (
  at: Reading,
  edit: Extract<Edit, { verb: "add" }>,
): Resolved => {
  const anchor = edit.at
  // A brand-new outline's first row: the only place the browser names a FILE,
  // and `add` is what refuses one the set does not hold.
  if (anchor.kind === "first") {
    return Result.succeed({ op: "add", file: anchor.file, title: edit.title })
  }
  const target = at.derived.byId.get(anchor.id)
  if (target === undefined) return Result.fail(notFound(at.derived, anchor.id))
  // Under a node: last among its children, which is where the first child of
  // an empty branch goes and where every later one would go anyway. A MIRROR
  // has no children of its own — what hangs under it belongs to the node it
  // shows — so this one is the ops layer's to refuse, in its own words.
  if (anchor.kind === "under") {
    return Result.succeed({ op: "add", parent: anchor.id, title: edit.title })
  }
  // After a row: the same parent as the row it follows, placed immediately
  // after it. A row at top level has no parent, and then the FILE is what says
  // where it goes — the pair `add` takes.
  //
  // The anchor may be a MIRROR, and that is the point rather than an oversight:
  // a placement occupies a line among siblings, so `Enter` on one makes a
  // sibling OF THE MIRROR — the new row appears where the reader is looking,
  // rather than beside the node it stands for, somewhere else entirely.
  // Everything this needs (a parent, a file, an `ord` to sort among) a mirror
  // record carries like any other.
  const parent = target.node.parent
  return Result.succeed({
    op: "add",
    ...(parent === undefined ? { file: target.file } : { parent }),
    after: anchor.id,
    title: edit.title,
  })
}

// ── the four moves ─────────────────────────────────────────────────────

const moveRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "move" }>,
): Resolved => {
  const located = derived.byId.get(edit.id)
  if (located === undefined) return Result.fail(notFound(derived, edit.id))
  // A MIRROR is moved as itself — it is a placement, and a placement is a row
  // a reader can reorder — so this is the row's own record rather than what it
  // shows. That is the opposite of a text edit, which the ops layer refuses on
  // a mirror because a mirror has no title of its own.
  const { file, node } = located
  const row = siblingsOf(derived, file, node.parent)
  const at = row.findIndex((sibling) => sibling.node.id === edit.id)

  switch (edit.how) {
    case "up": {
      const above = row[at - 1]
      if (above === undefined) {
        return Result.fail(
          refusal("this is the first of its siblings, so there is nothing above it to move past"),
        )
      }
      return Result.succeed({ op: "move", id: edit.id, before: above.node.id })
    }
    case "down": {
      const below = row[at + 1]
      if (below === undefined) {
        return Result.fail(
          refusal("this is the last of its siblings, so there is nothing below it to move past"),
        )
      }
      return Result.succeed({ op: "move", id: edit.id, after: below.node.id })
    }
    case "in": {
      // Indenting is "become a child of the row above", which is what makes it
      // impossible for the first row of a level: there is nothing above it at
      // the same depth to go under.
      const above = row[at - 1]
      if (above === undefined) {
        return Result.fail(
          refusal("this is the first of its siblings, so there is no row above it to go under"),
        )
      }
      // The row above may be a MIRROR, and then the new parent is the node it
      // SHOWS. That is the one place this resolver names a node the caller
      // never did, so it is the one place it must name the same node an agent
      // would: a parent is a regular record (`packages/ops`'s `planMove`
      // refuses a placement, naming its target instead), and what hangs under a
      // mirror on screen belongs to that target. Emitting the placement's own
      // id would be a request the ops layer always refuses — a keyboard that
      // could not do what the equivalent `move_node` does, which is exactly the
      // deviation HACKING.md forbids.
      const parent = nodeNamed(derived, above.node.id)
      if (parent === undefined) {
        return Result.fail(
          refusal(
            "the row above is a mirror of a node that is not in the loaded set, so there is nothing to go under",
          ),
        )
      }
      // Last among its new siblings — no `before`/`after` — which is where an
      // indent visually lands: directly under the row it just went beneath.
      // Whether that parent is REACHABLE — same file, no loop — is the ops
      // layer's to judge, and it judges it identically for both faces.
      return Result.succeed({ op: "move", id: edit.id, parent: parent.node.id })
    }
    case "out": {
      const parent = node.parent
      if (parent === undefined) {
        return Result.fail(
          refusal("this row is already at the top level, so there is nothing to outdent out of"),
        )
      }
      const above = derived.byId.get(parent)
      return Result.succeed({
        op: "move",
        id: edit.id,
        // Up one level, and immediately after what used to be its parent —
        // which is where the eye expects it, and what keeps the rows that
        // followed it under that parent still following it.
        parent: above?.node.parent ?? null,
        after: parent,
      })
    }
  }
}

/** What to call a record in a sentence. A MIRROR has no title of its own — it
 *  is a placement of a node that does — so it answers to the id it was named
 *  by, which is the same choice `@olai/ops` makes in its own commit lines. */
const nameOf = (located: Located): string =>
  isMirror(located.node) ? located.node.id : located.node.title

/** A refusal in this layer's own words: the four moves each say why they could
 *  not happen, and the sentence IS the message a reader gets. One spelling of
 *  the constructor so the four read as four sentences rather than four
 *  structs. What an id nothing declares refuses with is not here at all —
 *  `@olai/ops` owns that one (`notFound`), and a second copy of it here was
 *  the same refusal in two places. */
const refusal = (reason: string): OpFailure => new UsageFailure({ reason })
