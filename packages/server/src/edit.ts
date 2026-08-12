/**
 * What a keyboard MEANT, in terms of ops.
 *
 * The browser sends intents — "indent this", "toggle done", "a new sibling
 * after that" ({@link ../../surface/src/edit.ts}) — and every one of them
 * becomes exactly ONE {@link Request} for the ops layer to plan. This file is
 * that mapping and nothing else: it reads the snapshot, works out the
 * placement the intent implies, and hands back a request. It writes nothing,
 * touches no disk, and knows about no socket.
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
 * It answers a SECOND question about the same reading, and for the same
 * reason: {@link inverseOf} says what would take a write back — where the row
 * sits before it moves, which mark it carries before a toggle replaces it.
 * Those are facts about the set, they stop being true the moment the write
 * lands, and a browser noting them down for itself would be exactly the second
 * reading the paragraph above rules out. What comes back on the answer is
 * therefore a REQUEST an undo can replay, never a snapshot to restore.
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
    // The two that resolve nothing, and are spelled like the ops they are —
    // which is what makes the three above legible as the ones that do.
    case "title":
      return Result.succeed({ op: "title", id: edit.id, title: edit.title })
    case "desc":
      return Result.succeed({ op: "desc", id: edit.id, desc: edit.desc })
    case "place":
      return placeRequest(at.derived, edit)
    case "mark":
      return markRequest(at.derived, edit)
    case "remove":
      return removeRequest(at.derived, edit)
  }
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
  const { row, at } = among(derived, located)

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
      const parent = located.node.parent
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

// ── the three an undo speaks ───────────────────────────────────────────

/**
 * A row, put back where it sat.
 *
 * The parent travels as it was recorded — an id the SERVER read off the
 * snapshot the original move was judged against, so it is an id an agent would
 * have named — and the neighbour is resolved HERE, against the set as it is
 * now, for the same reason every other placement is: "first among its
 * siblings" is a fact about the row as it stands this instant, and a browser
 * answering it would be answering from a tree some frames old.
 *
 * `after: null` is that case, and it is `before` the row that is first NOW
 * rather than an ord computed from the one that was first then: if another
 * writer has put something at the front in the meantime, an undo that says
 * "back to the top of this branch" means the top as it now reads. When there
 * is nothing there at all the anchor is dropped and the ops layer's own
 * default — last — is the only place it can go.
 */
const placeRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "place" }>,
): Resolved => {
  const located = derived.byId.get(edit.id)
  if (located === undefined) return Result.fail(notFound(derived, edit.id))
  if (edit.after !== null) {
    return Result.succeed({ op: "move", id: edit.id, parent: edit.parent, after: edit.after })
  }
  // The first row that is not this one — `find` rather than a filtered copy,
  // because the answer is one sibling and the list it is drawn from is every
  // top-level record in the set when the parent is `null`.
  const first = siblingsOf(derived, located.file, edit.parent ?? undefined)
    .find((sibling) => sibling.node.id !== edit.id)
  return Result.succeed({
    op: "move",
    id: edit.id,
    parent: edit.parent,
    ...(first === undefined ? {} : { before: first.node.id }),
  })
}

/**
 * A mark, put back.
 *
 * Which op that is depends on what is being restored rather than on what is
 * there: putting one ON is that mark's own op, and putting NONE back is the
 * stored mark's op with `undo` — the same two calls an agent makes, so the
 * refusals are the ops layer's own (`already done`, `is not marked done`) and
 * this file invents none of them.
 *
 * The one it does invent is for a node that carries nothing when an undo asks
 * for nothing: there is no write in that, and the ops layer would have to be
 * told which mark to take off a node that has none. It means somebody else got
 * there first, which is a thing a person is owed a sentence about.
 */
const markRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "mark" }>,
): Resolved => {
  const located = derived.byId.get(edit.id)
  if (located === undefined) return Result.fail(notFound(derived, edit.id))
  if (edit.mark !== null) {
    return Result.succeed({ op: edit.mark, id: edit.id })
  }
  const stored = derived.status.get(edit.id)
  if (stored === undefined) {
    return Result.fail(
      refusal(`\`${nameOf(located)}\` carries no mark, so there is none to take off`),
    )
  }
  return Result.succeed({ op: stored, id: edit.id, undo: true })
}

/**
 * A row, taken back.
 *
 * `archive` is the whole of it, because `archive` is the whole of what the set
 * can do about a record it no longer wants: the node goes to `Archive.jsonl`
 * keeping its id, so anything pointing at it goes on resolving. That is a
 * trash rather than a shredder, and it is the same op `archive_node` runs.
 *
 * The guard is the one thing this adds, and it is about what an undo is
 * ENTITLED to: the row it takes back is the row it added, never a branch. A
 * node somebody has hung work under is no longer the empty line a key created,
 * and taking it back would take theirs with it.
 */
const removeRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "remove" }>,
): Resolved => {
  const located = derived.byId.get(edit.id)
  if (located === undefined) return Result.fail(notFound(derived, edit.id))
  const under = derived.children.get(edit.id) ?? []
  if (under.length > 0) {
    return Result.fail(
      refusal(
        `\`${nameOf(located)}\` has ${under.length} ${
          under.length === 1 ? "row" : "rows"
        } under it now — undo takes back the row it added, not what was put under it`,
      ),
    )
  }
  return Result.succeed({ op: "archive", id: edit.id })
}

// ── what would take a write back ───────────────────────────────────────

/**
 * The edits that would UNDO this one, read off the snapshot it is about to be
 * judged against.
 *
 * It is here, beside the resolver, because it is the same subject read the
 * other way: `requestFor` says what a key means over this reading, and this
 * says what the reading is about to stop saying. Both are pure over a
 * {@link Reading} and total over {@link Edit}, so a verb added to the surface
 * is answered twice or it does not compile.
 *
 * WHY THE SERVER AND NOT THE TAB: the facts an op destroys — the parent a row
 * had, the neighbour above it, the mark a toggle replaced — are facts about the
 * set the write is judged against. A browser keeping its own note of them
 * would be the second reading this whole seam exists to avoid, and the two
 * would differ exactly when it matters: when somebody else was writing too.
 *
 * WHAT IT DOES NOT CLOSE OVER is the same gap `requestFor` does not close over.
 * The store can move between this reading and the commit, and the ops layer
 * re-plans against the newer snapshot; an inverse derived here describes the
 * reading the request was resolved against. It is replayed through the write
 * gate like anything else, so the worst case is a refusal naming what moved —
 * never a silent write to the wrong place.
 *
 * An empty list means nothing here would take it back, and the three that
 * answer that way each mean it differently: a `title` or a `desc` is the
 * draft's own to abandon (Escape, blur — the editor owns text), and a `remove`
 * has put a node in the archive, which no move brings out (a parent is
 * same-file by the format).
 *
 * WHERE IT WOULD GO IF THE AGENT EVER WANTED ONE: down, into `@olai/ops`'
 * planner, beside the op whose effect it reverses — that is the layer that
 * already knows what each op destroys, and it would answer for every request
 * rather than for the six a keyboard can send. It is here because undo is the
 * BROWSER's (the roadmap scopes it to "ops THIS client performed"), and
 * because six arms beside the resolver they mirror is a smaller thing than an
 * inverse for `create`, `mirror`, `see`, `after` and `archive` that nothing
 * would call. Recorded rather than done: the second consumer is the moment to
 * move it.
 */
export const inverseOf = (
  at: Reading,
  edit: Edit,
  /** The node the write turned out to be about — which for an `add` is the row
   *  that did not exist when this reading was taken, and is the only thing here
   *  that cannot be read off it. */
  applied: string,
): ReadonlyArray<Edit> => {
  switch (edit.verb) {
    case "add":
      return [{ verb: "remove", id: applied }]
    // Both are the same question — where does this row sit right now — asked
    // before the write that moves it. A `place` being undone is a `place`
    // back, which is what makes redo the same machinery as undo.
    case "move":
    case "place":
      return placementOf(at.derived, edit.id)
    case "toggle":
    case "mark":
      return markOf(at.derived, edit.id)
    case "remove":
    case "title":
    case "desc":
      return []
  }
}

/** Where a row sits, as the one edit that would put it back there — and
 *  nothing at all for an id this reading does not hold, which the write about
 *  to be judged against it will refuse in its own words a moment later. */
const placementOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined) return []
  const { row, at } = among(derived, located)
  const above = row[at - 1]
  return [{
    verb: "place",
    id,
    parent: located.node.parent ?? null,
    after: above?.node.id ?? null,
  }]
}

/**
 * The mark a node carries, as the edits that would put it back.
 *
 * TWO of them whenever what is being restored is not `done`, and that is the
 * ops layer's policy showing through rather than a shape chosen here: any mark
 * other than `done` over a node that IS done is refused — "nothing should
 * decide on your behalf that finished work is not finished" — and the node
 * these are replayed against is one this write is about to tick off. So the
 * `done` comes off first and the old mark goes back on, which is exactly the
 * two calls an agent would make. Anything else would be the web doing in one
 * op what MCP needs two for, which is the deviation HACKING.md forbids.
 */
const markOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const stored = derived.status.get(id) ?? null
  return stored === null || stored === "done"
    ? [{ verb: "mark", id, mark: stored }]
    : [{ verb: "mark", id, mark: null }, { verb: "mark", id, mark: stored }]
}

/**
 * The row a record sits in, and where in it.
 *
 * One spelling, because the two questions asked of it have to agree exactly:
 * `Alt+Shift+↑` moves a row past the sibling above it, and the inverse of a
 * move records the sibling above it. Two scans, however alike they looked,
 * would be two chances for an undo to land one row off — which nothing but a
 * browser test would ever notice.
 */
const among = (
  derived: Derived,
  located: Located,
): { readonly row: ReadonlyArray<Located>; readonly at: number } => {
  const row = siblingsOf(derived, located.file, located.node.parent)
  return { row, at: row.findIndex((sibling) => sibling.node.id === located.node.id) }
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
