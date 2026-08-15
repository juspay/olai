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
  dailyNotePathFor,
  type Derived,
  INBOX,
  inboxIn,
  isDay,
  isMirror,
  type Located,
  type LocatedRegular,
  nodeNamed,
  type OpFailure,
  siblingsOf,
  type Status,
  UsageFailure,
} from "@olai/format"
import { merging, notFound, type Reading, type Request } from "@olai/ops"
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
    case "capture":
      return captureRequest(at, edit)
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
    // The two COMPOUND keys, and they resolve nothing for the same reason the
    // five above do: everything either of them needs to work out — where the
    // tail lands, which sibling is above, what the archive's scaffold is — the
    // op itself reads off the snapshot it is judged against, because it is one
    // op and that is where its arithmetic belongs. A resolver that assembled
    // them out of `title` + `add` would be the web doing in one keystroke what
    // MCP needs two calls for.
    case "split":
      return Result.succeed({
        op: "split",
        id: edit.id,
        title: edit.title,
        rest: edit.rest,
      })
    case "merge":
      return Result.succeed({ op: "merge", id: edit.id })
    case "unmirror":
      return Result.succeed({ op: "unmirror", id: edit.id })
    case "mirror":
      return mirrorRequest(at, edit)
    case "archive":
      return Result.succeed({ op: "archive", id: edit.id })
    case "unarchive":
      return Result.succeed({
        op: "unarchive",
        id: edit.id,
        ...(edit.parent === undefined ? {} : { parent: edit.parent }),
        ...(edit.file === undefined ? {} : { file: edit.file }),
      })
    // The two EDGE verbs, and they resolve nothing at all — which is the point
    // of them carrying the op's own two lists rather than one target and a
    // direction. Every rule about what may go in them is the planner's: an id
    // the set does not declare, a call that names neither list, a `see` that
    // would change nothing, an `after` that would close a loop. Each of those
    // sentences reaches the browser exactly as it reaches an agent's `set_see`
    // and `set_after`.
    //
    // ONE arm for both, because the verb IS the op — the same discriminant
    // trick `toggle` above uses for the marks, and the same pairing `inverseOf`
    // already makes for these two. A third writable edge field is a name in the
    // union and nothing here.
    case "see":
    case "after":
      return Result.succeed({
        op: edit.verb,
        id: edit.id,
        ...(edit.add === undefined ? {} : { add: edit.add }),
        ...(edit.remove === undefined ? {} : { remove: edit.remove }),
      })
    case "place":
      return placeRequest(at.derived, edit)
    case "mark":
      return markRequest(at.derived, edit)
    case "remove":
      return removeRequest(at.derived, edit)
    // The documents' three. The first two resolve nothing — a file is named
    // as the caller named it, and the ops layer's own refusals judge it — and
    // the third is the one derivation a calendar cell cannot make for itself.
    case "doc":
      return Result.succeed({
        op: "doc",
        file: edit.file,
        text: edit.text,
        ...(edit.was === undefined ? {} : { was: edit.was }),
      })
    case "docNew":
      return Result.succeed({ op: "create-doc", file: edit.file })
    // …and the outline's own creation door, which resolves nothing for the same
    // reason: the path is the caller's, and whether it is a relative `.olai`
    // the set does not already hold is `create_outline`'s own judgement, in its
    // own words. No `seed` — a person's first row is an `add` at the anchor the
    // empty file offers (`Anchor`'s `first`).
    case "outlineNew":
      return Result.succeed({ op: "create", file: edit.file })
    case "docDay": {
      // The day's shape is checked HERE because the path it derives would
      // otherwise be judged instead: a garbage date fed to the convention
      // walk would refuse as "not a relative `.md` path", which teaches a
      // reader about the wrong field.
      if (!isDay(edit.date)) {
        return Result.fail(
          refusal(`\`${edit.date}\` is not a day (YYYY-MM-DD), so there is no note to mint for it`),
        )
      }
      // WHERE the vault keeps its daily notes is a fact about the set — the
      // newest existing note's own path is the convention — so it is read off
      // the reading this write is judged against, exactly as every other
      // placement is, and an agent makes the same two moves by hand.
      const file = dailyNotePathFor(
        at.set.documents.map((document) => document.file),
        edit.date,
      )
      return Result.succeed({ op: "create-doc", file })
    }
  }
}

// ── a new row ──────────────────────────────────────────────────────────

/**
 * WHERE an anchor puts a row, in the two or three fields an op takes for it —
 * a parent or a file, and the neighbour to sit after when there is one.
 *
 * Shared by the two verbs that create a row, and shared rather than written
 * twice because it is one question: `add` mints a node there and `mirror`
 * places a second copy of one there, and the day the answer for one of them
 * changed while the other stayed put would be the day `Enter` and `((` started
 * disagreeing about what "after this row" means. What differs between the two
 * is only what is BEING placed, which each caller spreads its own fields for.
 */
type Landing =
  | { readonly parent: string; readonly after?: string }
  | { readonly file: string; readonly after?: string }

const landingFor = (
  at: Reading,
  anchor: Extract<Edit, { verb: "add" }>["at"],
): Result.Result<Landing, OpFailure> => {
  // A brand-new outline's first row: the only place the browser names a FILE,
  // and the op is what refuses one the set does not hold.
  if (anchor.kind === "first") return Result.succeed({ file: anchor.file })
  const target = at.derived.byId.get(anchor.id)
  if (target === undefined) return Result.fail(notFound(at.derived, anchor.id))
  // Under a node: last among its children, which is where the first child of
  // an empty branch goes and where every later one would go anyway. A MIRROR
  // has no children of its own — what hangs under it belongs to the node it
  // shows — so this one is the ops layer's to refuse, in its own words.
  if (anchor.kind === "under") return Result.succeed({ parent: anchor.id })
  // After a row: the same parent as the row it follows, placed immediately
  // after it. A row at top level has no parent, and then the FILE is what says
  // where it goes — the pair both ops take.
  //
  // The anchor may be a MIRROR, and that is the point rather than an oversight:
  // a placement occupies a line among siblings, so `Enter` on one makes a
  // sibling OF THE MIRROR — the new row appears where the reader is looking,
  // rather than beside the node it stands for, somewhere else entirely.
  // Everything this needs (a parent, a file, an `ord` to sort among) a mirror
  // record carries like any other.
  const parent = target.node.parent
  return Result.succeed({
    ...(parent === undefined ? { file: target.file } : { parent }),
    after: anchor.id,
  })
}

const addRequest = (
  at: Reading,
  edit: Extract<Edit, { verb: "add" }>,
): Resolved => {
  const landing = landingFor(at, edit.at)
  if (Result.isFailure(landing)) return Result.fail(landing.failure)
  return Result.succeed({ op: "add", ...landing.success, title: edit.title })
}

/** A second placement of a node that already exists, where the anchor says —
 *  `add_mirror`, with the target travelling as the caller named it. Whether
 *  that id is a node at all, and whether a mirror of it may sit there (a
 *  placement inside the subtree it shows expands forever), is the ops layer's
 *  to judge, in its own words, exactly as it judges an agent's `add_mirror`. */
const mirrorRequest = (
  at: Reading,
  edit: Extract<Edit, { verb: "mirror" }>,
): Resolved => {
  const landing = landingFor(at, edit.at)
  if (Result.isFailure(landing)) return Result.fail(landing.failure)
  return Result.succeed({ op: "mirror", ...landing.success, target: edit.target })
}

// ── the inbox ──────────────────────────────────────────────────────────

/**
 * A captured line, as ONE op — an `add` into the inbox the directory has, or
 * the `create` that mints it holding exactly this line.
 *
 * It names no {@link Landing}, and that is the difference between it and the
 * two above rather than an omission: they place a row where a reader is
 * standing, and this one is the write whose whole promise is that the reader
 * does not move. There is no anchor to resolve — only a FILE to find.
 *
 * The choice is made HERE, against the reading the write is judged on, for the
 * reason every placement in this file is: a browser choosing between them
 * would be choosing off a file list some frames old, and the two answers are
 * not interchangeable — `create` is refused for a file that exists, and `add`
 * is refused for one that does not. Either way it is one plan, one validation
 * and one atomic write, so a capture that is refused leaves nothing behind —
 * not a half-filled inbox, and not an empty file.
 *
 * WHICH file the inbox is, though, is `@olai/format`'s ({@link inboxIn}) and
 * not this resolver's: it is a statement about what a served file IS by its
 * name, the same kind of thing `ARCHIVE` is, and an agent capturing by hand
 * has to be able to read the same sentence rather than guess at the browser's.
 *
 * The title travels VERBATIM, blank and all: a capture of nothing is refused
 * by the ops layer in its own words ("a node needs a title"), which is the
 * same sentence an agent's `add_node` gets, rather than by a second rule here.
 */
const captureRequest = (
  at: Reading,
  edit: Extract<Edit, { verb: "capture" }>,
): Resolved => {
  const inbox = inboxIn(at.set.files)
  return Result.succeed(
    inbox === undefined
      ? { op: "create", file: INBOX, seed: { title: edit.title } }
      : { op: "add", file: inbox, title: edit.title },
  )
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
 * can do about a record it no longer wants: the node goes to `Archive.olai`
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
 * rather than for the ones this surface can send. It is here because undo is
 * the BROWSER's (the roadmap scopes it to "ops THIS client performed"), and
 * because the arms beside the resolver they mirror are a smaller thing than an
 * inverse for every op that nothing would call. Recorded rather than done: the
 * second consumer is the moment to move it.
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
    // A capture is an `add` a person did not choose the place for, so it is
    // taken back the same way — the row goes, by the same narrowed un-create.
    // What a ⌘Z does NOT do is unmint an inbox this capture created: no face
    // removes a file (`docNew` below says the same), so what is left is an
    // empty outline in the sidebar, which is a thing a reader can see and
    // delete rather than a file quietly appearing and disappearing.
    case "capture":
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
    // A split is taken back by MERGING the half it made back into the half it
    // came off — one edit, and the ops layer's own inverse rather than one
    // assembled here. `applied` is the new node, which is the only id in this
    // whole function that did not exist when the reading was taken.
    //
    // IT CARRIES NO `was`, and that is a known residual rather than an
    // oversight (reviewed twice, 2026-08-14). The alternative on the table was
    // `remove` + a guarded `title`, and it is worse where it counts: `remove`
    // is undone by `unarchive`, which lands LAST among its siblings, so undo
    // then redo of a split in the middle of a row would put the tail at the end
    // of it. Merge-as-inverse gets the placement right because the merge's own
    // inverse carries a `place`. What is left open is the same contract every
    // opposite-op inverse here already has (`unarchive` answers with `archive`
    // and no guard either): a concurrent retitle of the head is concatenated
    // rather than refused, and rows somebody hung under the tail are adopted
    // rather than refusing. Closing it means guarding `merge` itself — on both
    // faces, so an agent's `merge_node` gets the same field — which is a change
    // to the op rather than to this arm.
    case "split":
      return [{ verb: "merge", id: applied }]
    // A merge is the one write here whose inverse is a SEQUENCE, and it is a
    // sequence because the write is a compound the surface has no single
    // opposite for — `split` cannot mint a node that already exists in the
    // trash carrying its own mark, note and edges.
    case "merge":
      return unmergeOf(at.derived, edit.id)
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
    // The two edge verbs are their own inverse read the other way round: what
    // this write ADDS is what would be removed, and what it removes is what
    // would go back on.
    case "see":
    case "after":
      return edgesOf(at.derived, edit)
    // The inverse of an unarchive is the archive that made it — same subtree,
    // same scaffold rebuilt, so ⌘Z after a `Put back` puts it back IN.
    case "unarchive":
      return [{ verb: "archive", id: edit.id }]
    // A placement is taken back by retiring it, and `applied` is the placement
    // the write minted — never the target, which this write did not touch. One
    // edit, exact, and its own inverse is refused by the ops layer for the same
    // reason any `remove_mirror` is when something still names the row.
    case "mirror":
      return [{ verb: "unmirror", id: applied }]
    // An `unmirror` still answers with NOTHING, and the reason narrowed rather
    // than went away when `mirror` above arrived. A placement can now be
    // created from this surface — but not AT A GIVEN SLOT with a GIVEN ID, and
    // an undo needs both: {@link Anchor}'s arms mean "after this row" and "last
    // under this node", so a placement that was first among its siblings has no
    // anchor that names where it sat, and the id the replay would mint is not
    // the id the row had. Spelling it as `mirror` + `place` does not work
    // either — the second edit would have to name an id the first one has not
    // minted yet, and an undo entry is a list of edits, not a program. So this
    // stays the one write here that cannot be taken back, said by answering
    // nothing rather than by leaving a ⌘Z that quietly does the wrong thing.
    case "unmirror":
      return []
    // A document commit is the text verbs' shape at file size: the inverse is
    // the text it replaced, guarded by what this write wrote, so ⌘Z can only
    // take back this tab's own words and somebody else's land as a refusal.
    case "doc":
      return documentTextOf(at, edit)
    // Nothing takes a minted file back: there is no document removal on ANY
    // face, which is an equal absence rather than a deviation — the shape
    // `parity-unarchive` was in until #147 gave the archive its way out, and
    // the same argument applies here. So the un-create cannot be spelled, and
    // the entry says so by answering nothing rather than by leaving a ⌘Z that
    // quietly does nothing.
    case "docNew":
    case "docDay":
    // A minted OUTLINE is the same answer for the same reason, and it is the
    // one an existing arm already relies on: quick capture into a directory
    // with no inbox mints `Inbox.olai`, and its ⌘Z takes the LINE back and
    // leaves the file — an empty outline in the sidebar, which is a thing a
    // reader can see, rather than a file quietly appearing and disappearing.
    case "outlineNew":
      return []
  }
}

/**
 * What an edge write would put back — the same verb with its two lists
 * swapped, narrowed to what the write actually CHANGES.
 *
 * The narrowing is the whole of it. `set_see` is incremental on purpose: adding
 * a target the node already lists is a no-op for that target, and removing one
 * it never had is the same read backwards. An inverse spelled off the REQUEST
 * would drop an edge that was there before the write — the undo of "link to X"
 * on a node that already saw X — so it is spelled off the SNAPSHOT the write is
 * about to be judged against, which is what every other inverse here does and
 * for the identical reason. Nothing at all when nothing would change, which is
 * a call the planner is about to refuse in its own words anyway.
 *
 * A KNOWN RESIDUAL, and it is the op's rather than this arm's: an add appends,
 * so putting back an edge that was removed from the MIDDLE of a list lands it
 * at the end. The relation is the same set either way — blockedness is a set,
 * and `see` is a list of links — and closing it would mean a whole-array write
 * on both faces, which is a change to `set_see` rather than to an undo.
 *
 * AND THE COUPLING WORTH NAMING, because it is the first of its kind here:
 * every other inverse in this file reads a FACT the op is about to destroy
 * (where a row sat, which mark it carried), and this one reproduces the op's
 * own incremental add/remove ARITHMETIC. Nothing in the type system ties the
 * two, so a `set_see` that became a whole-array replace would leave this
 * silently wrong — and the append-order residual above is the same split read
 * from the other end. That is exactly the move this function's own header
 * records as deferred: down, into `@olai/ops`' planner, beside the op whose
 * effect it reverses, where a plan could carry the field's previous value
 * instead. The second consumer is still the moment to move it; this arm is the
 * first argument FOR moving it.
 *
 * A MIRROR carries no edges of its own (the format's rule, and `derive`'s), so
 * there is nothing to take back; the write is the ops layer's to refuse.
 */
const edgesOf = (
  derived: Derived,
  edit: Extract<Edit, { verb: "see" | "after" }>,
): ReadonlyArray<Edit> => {
  const located = derived.byId.get(edit.id)
  if (located === undefined || isMirror(located.node)) return []
  const held = located.node[edit.verb] ?? []
  const added = (edit.add ?? []).filter((id) => !held.includes(id))
  const removed = (edit.remove ?? []).filter((id) => held.includes(id))
  if (added.length === 0 && removed.length === 0) return []
  return [{
    verb: edit.verb,
    id: edit.id,
    ...(removed.length === 0 ? {} : { add: removed }),
    ...(added.length === 0 ? {} : { remove: added }),
  }]
}

/** The text a document holds, as the edit that would put it back — and nothing
 *  for a path the reading does not hold, whose write the ops layer is about to
 *  refuse in its own words. */
const documentTextOf = (
  at: Reading,
  edit: Extract<Edit, { verb: "doc" }>,
): ReadonlyArray<Edit> => {
  const document = at.set.documents.find((entry) => entry.file === edit.file)
  if (document === undefined) return []
  return [{ verb: "doc", file: edit.file, text: document.text, was: edit.text }]
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

/**
 * What would take a MERGE back — the one inverse on this list that is a whole
 * sequence, and every step of it is a verb this surface already has.
 *
 * The merge is about to do four things to the outline: put this row's title and
 * note onto the row above, hand that row everything hanging under this one, and
 * put this record into the archive. So the way back is those four undone, in the
 * order that makes each one possible:
 *
 *   1. `unarchive` the record — which is where its mark, its date and its edges
 *      have been all along, because the merge never copied them anywhere. It
 *      lands last among its siblings, carrying the parent (or the file) this
 *      reading says it sits in, which are ids the SERVER derived — the `place`
 *      rule.
 *   2. `place` it back after the row it was merged into, since "last" is not
 *      where it was.
 *   3. `place` each child back under it, in order — first with no neighbour,
 *      then each after the one before, which reproduces the row exactly.
 *   4. put the surviving row's `title` and `desc` back, GUARDED by what the
 *      merge is about to make them ({@link merging}, the ops layer's own
 *      answer to both "which row" and "what the join makes"). So an undo can
 *      only overwrite what the merge wrote: retype that row in the meantime and
 *      the undo is refused naming what is there, exactly as an undone retitle
 *      is.
 *
 * Replayed in order through the same gate, each judged against the set as it is
 * THEN, and a refusal partway stops there — which is the same contract every
 * two-step mark undo already has, one step longer.
 *
 * Nothing at all for a reading that does not hold the id, for a placement, or
 * for a row with nothing above it: those are the merge's own refusals, so there
 * is no write to take back.
 */
const unmergeOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return []
  // EVERY fact about the merge is the ops layer's — which row it joins, what
  // the join makes, and which children move in what order — read off the same
  // answer the write is about to be planned from. Re-derived here they would be
  // a second scan of the sibling row, a second spelling of the join and a second
  // reading of the branch, and each would be wrong in exactly the case an undo
  // is for.
  const joined = merging(derived, located as LocatedRegular)
  if (Result.isFailure(joined)) return []
  const { into, adopted, title, desc } = joined.success
  return [
    // Where the row goes back to is `archive`'s own inverse, which already
    // knows the parent-or-file pair and reads it off this same snapshot.
    ...unarchiveOf(derived, id),
    { verb: "place", id, parent: located.node.parent ?? null, after: into.id },
    ...adopted.map((child, index): Edit => ({
      verb: "place",
      id: child.node.id,
      parent: id,
      after: index === 0 ? null : (adopted[index - 1] as Located).node.id,
    })),
    // The two texts, put back the way EVERY text undo is put back — `textOf`
    // carries the `was` convention and the "an absent note is `null`" rule, and
    // a second copy of them here would be a second place to keep those true.
    ...textOf(derived, { verb: "title", id: into.id, title }),
    // Only when the merge MOVED it. A row whose note is untouched — because the
    // row below had none — needs no second write, and one that said `was` for a
    // note it did not change would be refused by nothing and mean nothing.
    ...(desc === into.desc ? [] : textOf(derived, { verb: "desc", id: into.id, desc: desc ?? null })),
  ]
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
