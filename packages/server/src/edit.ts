/**
 * What a keyboard — or a menu entry — MEANT, in terms of ops.
 *
 * The browser sends intents — "indent this", "toggle done", "walk this mark on
 * one", "a new sibling after that", "this node is doing now"
 * ({@link ../../surface/src/edit.ts}) —
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
  type Status,
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
    case "walk":
      return walkRequest(at.derived, edit)
    // The five that resolve nothing, and are spelled like the ops they are —
    // which is what makes the ones above legible as the ones that do. Three
    // are the menu's: a date is a date, a placement is named by the row it is,
    // and a subtree is what `archive` has always taken.
    //
    // `was` travels WITH the request rather than being checked here, and that
    // is not tidiness: the write gate re-plans a request when the store moves
    // under it, so a condition tested at this seam is a condition the retry
    // does not test — which is a concurrent retitle overwritten by an undo that
    // was told not to (found by review, 2026-08-12). The ops layer checks it on
    // every attempt, against the snapshot that attempt is judged on.
    case "title":
      return Result.succeed({
        op: "title",
        id: edit.id,
        title: edit.title,
        ...(edit.was === undefined ? {} : { was: edit.was }),
      })
    case "desc":
      return Result.succeed({
        op: "desc",
        id: edit.id,
        desc: edit.desc,
        ...(edit.was === undefined ? {} : { was: edit.was }),
      })
    case "date":
      return Result.succeed({ op: "date", id: edit.id, date: edit.date })
    case "unmirror":
      return Result.succeed({ op: "unmirror", id: edit.id })
    case "archive":
      return Result.succeed({ op: "archive", id: edit.id })
    case "unarchive":
      return Result.succeed({
        op: "unarchive",
        id: edit.id,
        ...(edit.parent === undefined ? {} : { parent: edit.parent }),
        ...(edit.file === undefined ? {} : { file: edit.file }),
      })
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

// ── the three that resolve something for a menu or an undo ─────────────

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
 * A mark, named outright — put ON, or taken OFF.
 *
 * ONE function for two callers, because they ask the same question: the `•••`
 * menu says "this node is doing now" and an undo says "it carried `todo`
 * before I ticked it off", and neither is a toggle.
 *
 * Which op that becomes depends on what is being ASKED FOR rather than on what
 * is there: a mark named outright is that mark's own op, and NONE is the stored
 * mark's op with `undo`, because that is the only way the ops layer spells
 * taking one off. Those are the same two calls an agent makes, so every refusal
 * met here is the ops layer's own — `already done`, `is not marked done`, and
 * the one that matters most, `done. Undo that first — nothing should decide on
 * your behalf that finished work is not finished`. A menu that quietly sent two
 * ops to walk `done` back to `todo` would be the web doing in one gesture what
 * MCP needs two for, which is the deviation HACKING.md forbids: the second
 * click is the person's, and an undo makes the two calls explicitly
 * ({@link markOf}).
 *
 * The one refusal this file invents is for a node that carries nothing when a
 * caller asks for nothing: there is no write in that, and the ops layer would
 * have to be told which mark to take off a node that has none. `Clear mark` is
 * drawn only on a marked row and an undo only restores what it displaced, so
 * either way it means somebody else got there first — which is a thing a person
 * is owed a sentence about rather than a silence.
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
 * THE RING the mark walk goes round, and the whole of the design is which
 * answers are on it.
 *
 * Three of the four are: **no mark → `todo` → `doing` → no mark**. Those are
 * the answers a person gives about work they have NOT finished, and the last
 * of them is an answer rather than a gap — the format's own rule, drawn as the
 * absence of a box (docs/format.md's Status). A walk that could not reach it
 * would be a keyboard that can put a box on a row and never take it off.
 *
 * **`done` is not a stop on it**, and it is the one entry here worth arguing.
 * A ring that passed through `done` would stamp a completion instant, fire the
 * rollup's nudge and — under the done toggle — take the row off the screen, all
 * on the way to somewhere else; finishing something is not a thing to do in
 * passing. `Ctrl+Enter` is where finishing lives, both ways, and it is the
 * mark that has an instant.
 *
 * So a `done` node's next step is `todo` — the first stop of the ring, asked
 * for OUTRIGHT, which the ops layer REFUSES: *"is done. Undo that first —
 * nothing should decide on your behalf that finished work is not finished."*
 * That is deliberate and it is the point of not fencing it here. The refusal
 * lands under the row in the ops layer's own words, and the sentence names the
 * key to press: `Ctrl+Enter` takes the `done` off, and the walk carries on from
 * there. Two ops, the second one the person's — exactly the two calls an agent
 * makes, and exactly what the `•••` menu already asks of the mouse. A ring that
 * quietly sent both would be the web doing in one keystroke what MCP needs two
 * for, which is the deviation HACKING.md forbids; a ring that skipped `done`
 * silently would be this file teaching a rule the ops layer owns, and hiding
 * the one refusal a person most needs to have met.
 */
const NEXT: Record<Status, Status | null> = {
  todo: "doing",
  doing: null,
  done: "todo",
}

/**
 * One step round {@link NEXT} — and then it is a MARK, named outright.
 *
 * That is the whole of this function, and it is why it does not build a request
 * of its own: "put this mark on" and "take the one it has off" are two things
 * {@link markRequest} already spells, for the `•••` menu and for an undo, and
 * the second of them is spelled in the one way the ops layer accepts (the
 * stored mark's own op, with `undo`). A walk that assembled those itself would
 * be that rule with two homes — and the day the ops layer spells clearing
 * differently, one of them would go on sending the old shape. So the walk
 * answers only the question that is its own: which answer comes next.
 *
 * The STORED mark is read here rather than sent, for the reason `toggle`'s is:
 * where the walk goes depends on where the node is, that is a fact about the
 * set this write is judged against, and a tab answering it from a frame it drew
 * would ask for a step somebody else had already taken. It is the mark a row
 * DRAWS, which for a placement is its target's (`Derived` makes that one hop),
 * so the step asked at a mirror is the step the reader can see. The ID is not
 * resolved with it — it travels as the caller named it, and a mark on a
 * placement is refused by the ops layer naming the node to use instead, exactly
 * as it refuses the same tool call from an agent.
 */
const walkRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "walk" }>,
): Resolved => {
  const stored = derived.status.get(edit.id)
  return markRequest(derived, {
    verb: "mark",
    id: edit.id,
    // A bullet is where the ring starts. An id nothing declares reads like one
    // here and is refused a line later, by the same `notFound` every other verb
    // answers with.
    mark: stored === undefined ? "todo" : NEXT[stored],
  })
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
 * An empty list means nothing here would take it back, and there is exactly
 * ONE write that answers that way now: an `unmirror`, whose inverse would be a
 * placement verb this surface does not have. A `remove` and an `archive`
 * answered that way while the archive had no way out; `unarchive` is that way
 * out (`parity-unarchive`), so both answer with it. A text edit used to answer
 * that way too, on the reading that the editor owns text — which is true of a
 * DRAFT, where Escape and blur are the semantics, and false of the op a
 * committed draft produced. A committed title has a perfect inverse: the title
 * it replaced.
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
  /** What {@link requestFor} made of that edit — the op that is about to run.
   *  Passed in rather than resolved again, and READ rather than re-derived: the
   *  one thing the mark verbs disagree about is whether the write leaves the
   *  node finished, and every one of them has already answered it here. */
  request: Request,
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
    // All three ask one question — which mark does this node carry right now —
    // before the write that replaces it. The only other thing `markOf` needs is
    // whether the write LEAVES the node done, and the resolved request is
    // exactly that answer: `done`'s own op, not being undone. Read off what is
    // about to run rather than restated per verb, so a fourth mark verb, or
    // `done` joining the ring, is answered by construction.
    case "toggle":
    case "walk":
    case "mark":
      return markOf(
        at.derived,
        edit.id,
        request.op === "done" && request.undo !== true,
      )
    // The text this write is about to replace, and the text it is replacing it
    // WITH — the second half being the guard, so the undo may only overwrite
    // what this write wrote. Symmetric, so replaying it answers with the pair
    // the other way round and ⌘⇧Z is the same machinery again.
    case "title":
    case "desc":
      return textOf(at.derived, edit)
    // The DATE this write is about to replace, which is the same shape as the
    // text pair one line up minus the guard: a date is one field with no
    // half-typed state behind it, so there is no draft for a stale undo to
    // overwrite — the ops layer's own `set_date` is what judges it either way.
    case "date":
      return dateOf(at.derived, edit.id)
    // BOTH removals answer with the way back out of the trash, now that there
    // is one (`parity-unarchive`): `unarchive`, carrying where the row SITS as
    // this reading stands — its parent, or its file at top level — because
    // those are facts the archive is about to replace with a scaffold of
    // titles, and an undo is entitled to better than a title match. The ids
    // are the server's own reading, so they are ids an agent would have named
    // (the `place` rule); the replay is judged against the set as it is THEN,
    // and a parent that has itself been archived since is the ops layer's
    // refusal to give, in its own words.
    case "remove":
    case "archive":
      return unarchiveOf(at.derived, edit.id)
    // The inverse of an unarchive is the archive that made it — same subtree,
    // same scaffold rebuilt, so ⌘Z after a `Put back` puts it back IN.
    case "unarchive":
      return [{ verb: "archive", id: edit.id }]
    // An `unmirror` COULD be undone in principle, by placing the mirror back
    // where it was; this surface has no verb for creating one (mirror creation
    // is `input-widgets`' `((`), and inventing a browser-only placement verb to
    // serve an undo would be exactly the deviation the menu's verbs exist to
    // close. When that verb arrives, this arm is where it is answered.
    case "unmirror":
      return []
  }
}

/** Where a row about to be archived sits, as the unarchive that would bring it
 *  back there — and nothing at all for an id this reading does not hold or for
 *  a placement, which the archive itself is about to refuse. */
const unarchiveOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return []
  const parent = located.node.parent
  return [{
    verb: "unarchive",
    id,
    ...(parent === undefined ? { file: located.file } : { parent }),
  }]
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
 * The text a node holds, as the edit that would put it back.
 *
 * It is the SAME verb read backwards — the inverse of setting a title is
 * setting the title it replaced — with `was` carrying what this write is about
 * to make true, so the undo is refused if anybody else has typed there since
 * (`@olai/ops`' planner checks it, on every attempt it makes — see the two
 * text arms of `requestFor`). A mirror has no text of its own and the ops layer
 * refuses the write, so there is nothing to take back.
 */
const textOf = (
  derived: Derived,
  edit: Extract<Edit, { verb: "title" | "desc" }>,
): ReadonlyArray<Edit> => {
  const located = derived.byId.get(edit.id)
  if (located === undefined || isMirror(located.node)) return []
  return edit.verb === "title"
    ? [{ verb: "title", id: edit.id, title: located.node.title, was: edit.title }]
    : [{ verb: "desc", id: edit.id, desc: located.node.desc ?? null, was: edit.desc }]
}

/**
 * The date a node carries, as the edit that would put it back — and nothing at
 * all for an id this reading does not hold, or a MIRROR, which has no date of
 * its own to restore (the menu names the node a row shows, so it does not send
 * one; an id that arrives anyway is the ops layer's to refuse).
 *
 * This is why the wire's `date` field is the op's full `string | null`: a
 * clear-only verb could not spell its own inverse, and `Clear date` is
 * precisely the write a person is most likely to want back. It answers for the
 * other direction too, now that the web can pick a day (`parity-date`) — a
 * date set over nothing is put back as nothing, which is the same arm.
 */
const dateOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return []
  return [{ verb: "date", id, date: located.node.date ?? null }]
}

/**
 * The mark a node carries, as the edits that would put it back.
 *
 * TWO of them for exactly one shape of write, and it is the ops layer's policy
 * showing through rather than a shape chosen here: a mark that is not `done`,
 * over a node that IS done, is refused — "nothing should decide on your behalf
 * that finished work is not finished". So when the write being reversed is the
 * one that ticks the node off, the `done` has to come off before the old mark
 * goes back on, which is exactly the two calls an agent would make. Anything
 * else would be the web doing in one op what MCP needs two for, which is the
 * deviation HACKING.md forbids.
 *
 * EVERY OTHER WAY BACK IS ONE CALL, and reading it as "two whenever a mark
 * displaced another" cost an undo: `Clear mark` on a `doing` row answered with
 * a pair whose first half — take the mark off — was refused a moment later
 * against the row it had just been taken off of ("carries no mark, so there is
 * none to take off"), and the entry was dropped with a reason nobody could act
 * on. The mark walk's last stop is that same write, so the bug was on the ring.
 * What decides it is not what is being restored but what the write LEAVES, and
 * that is read off the REQUEST rather than re-derived from the verb
 * ({@link inverseOf}) — the request is what is about to run, so it answers for
 * every mark verb there is and every one there will be.
 */
const markOf = (
  derived: Derived,
  id: string,
  /** Whether the write this reverses leaves the node DONE. */
  finished: boolean,
): ReadonlyArray<Edit> => {
  const stored = derived.status.get(id) ?? null
  const back: Edit = { verb: "mark", id, mark: stored }
  // The two guards are two different things being ruled out, and neither is the
  // other: a node that carried NOTHING goes back to carrying nothing, which is
  // the one call that can say "none" — and a node that carried `done` puts
  // `done` back, which is the one mark the ops layer never asks to be undone
  // first.
  return finished && stored !== null && stored !== "done"
    ? [{ verb: "mark", id, mark: null }, back]
    : [back]
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
