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
  captureInto,
  customOf as customOfNode,
  dailyNotePathFor,
  type Derived,
  isTrashed,
  TRASH_FILE,
  isDay,
  isMirror,
  type Located,
  type LocatedRegular,
  markdownAt,
  markdownIn,
  mintedInto,
  nodeNamed,
  nodesOf,
  type OpFailure,
  outlinePaths,
  PIN_NAME_UNWRITABLE,
  PINS,
  pinsIn,
  pinTitle,
  type Reading,
  siblingsOf,
  type Status,
  UsageFailure,
} from "@olai/format"
import { merging, notFound, type Request } from "@olai/ops"
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
    // A CAPTURED LINE, and the one arm here that resolves NOTHING of its own
    // any more. It names no `Landing` — the write whose whole promise is that
    // the reader does not move has no anchor, only a FILE to find — and which
    // file that is is `@olai/format`'s (`inbox.ts`'s `captureInto`), because
    // `POST /capture` captures into the same inbox from a share sheet and a
    // second copy of "is there an inbox yet, and what do I do about it" is two
    // answers about one directory.
    //
    // The title travels VERBATIM, blank and all: a capture of nothing is
    // refused by the ops layer in its own words ("a node needs a title"),
    // which is the same sentence an agent's `add_node` gets.
    //
    // It carries NO DATE where the HTTP door's capture does, and that is a
    // difference between two GESTURES rather than a deviation between two
    // faces: both send an `add` and the gate judges them identically. A `⌘K`
    // capture is made by somebody standing in the app with the Inbox door in
    // front of them; one that arrived from a phone while nobody was looking
    // has a day page as the only place it will be noticed.
    case "capture":
      return Result.succeed(captureInto(at, { title: edit.title }))
    case "pin":
      return pinRequest(at, edit)
    case "move":
      return moveRequest(at.derived, edit)
    // The FIFTH move, and the one that resolves NOTHING: the picker names the
    // parent outright, and where among that parent's children is the ops
    // layer's own default (last — `move_node` with a `parent` and no anchor,
    // which is the request `move in` above ends at). So there is nothing here
    // to read off the snapshot, and every refusal is `planMove`'s own: a parent
    // in another file, a parent inside the subtree being moved, an id nothing
    // declares. The picker draws the first two before `Enter` as well
    // (`@olai/format`'s `moving.ts`), which is an aim and not a fence —
    // this request is still the one an agent's `move_node` sends.
    case "under":
      return Result.succeed({ op: "move", id: edit.id, parent: edit.parent })
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
    // The six that resolve nothing, and are spelled like the ops they are —
    // which is what makes the ones above legible as the ones that do. Four
    // are the menu's: a date is a date, a repeat rule is a repeat rule, a
    // placement is named by the row it is, and a subtree is what `archive` has
    // always taken.
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
    // A rule resolves nothing either: it is TEXT the format itself reads, and
    // what it may say is the per-line check at the write gate — refused there
    // in the same words an agent's `set_repeat` meets, with `file:line`.
    case "repeat":
      return Result.succeed({ op: "repeat", id: edit.id, repeat: edit.repeat })
    // A property resolves nothing either: the key is the caller's and the value
    // is text. Which keys are refused is the ops layer's answer, said in its own
    // words at the one gate both faces go through.
    case "prop":
      return Result.succeed({ op: "prop", id: edit.id, key: edit.key, value: edit.value })
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
    case "trash":
      return Result.succeed({ op: "trash", id: edit.id })
    // A duplicate resolves nothing either, and for `archive`'s reason read the
    // other way: what the copy SAYS is already on disk, so the op reads the
    // subtree where the write is judged rather than being handed one. A
    // resolver that assembled it out of `add`s would be the web doing in one
    // keystroke what MCP needs a call per node for — and it could stop in the
    // middle, which is the half a person feels.
    case "duplicate":
      return Result.succeed({ op: "duplicate", id: edit.id })
    case "untrash":
      return Result.succeed({
        op: "untrash",
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
        markdownIn(at.set).map((document) => document.path),
        edit.date,
      )
      return Result.succeed({ op: "create-doc", file })
    }
    // THE ONE DELETE, and the one that resolves the MOST: what the browser
    // sends is "empty the Trash" and nothing else, because which archives this
    // directory holds — and which of them have anything in them — are facts
    // about the SET (`../../surface/src/edit.ts` argues it, and it is quick
    // capture's argument one page over). Read here, against the reading the
    // write is judged on, so a pile that arrived since the tab last drew the
    // page goes with the rest instead of being quietly left behind.
    case "emptyTrash":
      return emptyTrashRequest(at, edit)
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

/**
 * A PIN, resolved against the set: which file the shelf is, and whether there
 * is one yet.
 *
 * The capture arm one convention over, and deliberately the same two lines: an
 * existing shelf takes an `add`, a directory with none takes a `create` seeded
 * with this very address. The difference is where each LIVES — a capture has
 * two doors, so its resolution went down to `@olai/format` (`inbox.ts`), and
 * the shelf has one, so this one is still here. The reasoning is the same — where the file is is a fact about the SET, so it is read here rather
 * than in a tab holding a file list some frames old, and one op is what keeps a
 * refused pin from leaving an empty `Pins.olai` behind.
 *
 * WHERE ONE IS MINTED is `_olai/Pins.olai` and not the root (`mintedInto`,
 * human 2026-08-19): a file olai made because somebody pressed something is not
 * one of the reader's own, and the top level of a served directory is theirs.
 * The READING is untouched — a directory that already keeps a `Pins.olai`
 * anywhere goes on pinning into the file it has, which is what makes this a
 * change to the mint alone.
 *
 * NO ANCHOR, so a new pin lands LAST among the shelf's top-level rows — which
 * is where a new bookmark goes, and is the ops layer's own default for an
 * `add` that names no sibling. Where it goes AFTERWARDS is the drag's, and
 * that is a `place` like every other reordering in this app.
 *
 * ## The NAME, when the gesture carried one
 *
 * The row's title is the address, and a named pin's is that address inside a
 * markdown link — the spelling `Pins.olai` has always had and the one an agent
 * writes by hand (docs/format.md's Pins). It is composed HERE, beside the
 * placement, for the reason the placement is here: this is the one site that
 * knows the whole row it is about to add, so there is no moment at which a
 * half-named pin exists. `pinTitle` is `@olai/format`'s, the inverse of the
 * reader that draws one, so the two cannot disagree about where the brackets
 * go.
 *
 * A NAME THE LINK CANNOT HOLD IS REFUSED, in that function's own sentence — a
 * `]` closes the label early, and a title written past it is not an address
 * any more, so the row would leave the shelf with nothing said. That is a
 * `usage` refusal: nothing was read and nothing was written, which is exactly
 * what this is.
 */
const pinRequest = (
  at: Reading,
  edit: Extract<Edit, { verb: "pin" }>,
): Resolved => {
  const title = pinTitle(edit.at, edit.name ?? "")
  if (title === undefined) {
    return Result.fail(new UsageFailure({ reason: PIN_NAME_UNWRITABLE }))
  }
  const shelf = pinsIn(outlinePaths(at.set))
  return Result.succeed(
    shelf === undefined
      ? { op: "create", file: mintedInto(PINS), seed: { title } }
      : { op: "add", file: shelf, title },
  )
}

// ── the trash, emptied ─────────────────────────────────────────────────

/**
 * EVERY TRASH THAT HOLDS ANYTHING, emptied in ONE write — the resolution the
 * `Empty trash` button asks for.
 *
 * The reading is the whole of the work, and it is here for the reason every
 * placement in this file is here: which files the directory serves, which of
 * them are archives, and which of those have records in them are facts about
 * the SET, and the set this write is judged against is this one. A tab that
 * listed them for itself would be reading a manifest some frames old — and the
 * failure mode is not a refusal, it is a pile arriving between the draw and the
 * click and quietly surviving a gesture that said "everything".
 *
 * ONE OP NAMING THEM ALL, never a batch of one-per-archive — and that is a
 * correctness decision rather than a tidier spelling. `empty` judges what may
 * still point into an archive against the UNION of the archives it is emptying;
 * `apply` plans each op against the set the one before it left, so a `see` from
 * one pile into another reads as a holder of whichever pile is planned first.
 * The same two archives then refuse in path order, plan in the reverse, and
 * refuse both ways round when the two piles name each other — an emptying that
 * could never land, over records the write was going to delete anyway. Grok
 * found it against this resolver's own output (#250); the op's own field
 * argues it where it is declared.
 *
 * THE COUNT IS THE CALLER'S and is passed straight through. It is the number
 * the confirm put in front of somebody, and re-deriving it here would be
 * exactly the second reading the paragraph above rules out — this reading is
 * newer than the one they read, so a count taken here would always agree with
 * itself and could never refuse. What it guards against is the write widening
 * under a retry, and that is checked in the planner, on every attempt.
 *
 * AN EMPTY TRASH IS REFUSED HERE rather than sent as an `empty` of a file that
 * holds nothing, and the sentence is this resolver's own for the reason
 * `docDay`'s day-shape check is: the planner's already-empty refusal names the
 * file, which is true but not what a stale tab needs to hear. The button is
 * not drawn over an empty trash, so nothing a person can press reaches this
 * — what does is a stale tab, and a stale tab deserves the true sentence.
 */
const emptyTrashRequest = (
  at: Reading,
  edit: Extract<Edit, { verb: "emptyTrash" }>,
): Resolved => {
  const piles = outlinePaths(at.set).filter(
    (file) => isTrashed(file) && nodesOf(at.derived, file).length > 0,
  )
  if (piles.length === 0) {
    return Result.fail(refusal("the Trash is empty, so there is nothing to delete"))
  }
  return Result.succeed({
    op: "empty",
    file: TRASH_FILE,
    ...(edit.was === undefined ? {} : { was: edit.was }),
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
 * can do about a record it no longer wants: the node goes to `_olai/Trash.olai`
 * keeping its id, so anything pointing at it goes on resolving. That is a
 * trash rather than a shredder, and it is the same op `trash_node` runs.
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
  return Result.succeed({ op: "trash", id: edit.id })
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
    // empty inbox behind the sidebar's Inbox entry — a thing a reader can see
    // and delete rather than a file quietly appearing and disappearing.
    case "capture":
    // A pin is a capture onto the shelf, so ⌘Z is the same un-create: the pin's
    // row goes and the reader's page does not move. A shelf this pin MINTED is
    // left standing, exactly as a minted inbox is and for the reason written
    // there — no face removes a file.
    case "pin":
      return [{ verb: "remove", id: applied }]
    // Both are the same question — where does this row sit right now — asked
    // before the write that moves it. A `place` being undone is a `place`
    // back, which is what makes redo the same machinery as undo.
    case "move":
    case "place":
    // ...and the picker's move is the same question with a different way of
    // asking it: where does this row sit right now, read before the write that
    // carries it somewhere else. A `place` back is what puts it there again —
    // the parent AND the neighbour, because "under my old parent" would put a
    // row that was third among its siblings at the end of them.
    case "under":
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
    // The RULE this write is about to replace — the date arm one field along,
    // for the same reason and with the same shape.
    case "repeat":
      return repeatOf(at.derived, edit.id)
    // The VALUE this write is about to replace, under the key it names — the
    // date arm one map in. A property set where there was none is put back by
    // removing it, which is the `null` this hands back and what makes the
    // drawer's `Remove` a thing a person can take back.
    case "prop":
      return propOf(at.derived, edit.id, edit.key)
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
    case "trash":
      return unarchiveOf(at.derived, edit.id)
    // The two edge verbs are their own inverse read the other way round: what
    // this write ADDS is what would be removed, and what it removes is what
    // would go back on.
    case "see":
    case "after":
      return edgesOf(at.derived, edit)
    // The inverse of an unarchive is the archive that made it — same subtree,
    // same scaffold rebuilt, so ⌘Z after a `Put back` puts it back IN.
    case "untrash":
      return [{ verb: "trash", id: edit.id }]
    // A duplicate is taken back by putting the COPY away — `applied` is the
    // copy's root, never the original, which this write did not touch. It is
    // `remove`'s answer without `remove`'s narrowing, and the narrowing has
    // nothing to narrow to: that rule exists because an `add` makes ONE row and
    // an undo may not take away what somebody built on it, while a duplicate
    // makes a BRANCH by construction and taking it back means taking the branch
    // it made. What that leaves open is the same window `archive`'s own inverse
    // has — a row somebody filed under the copy in the meantime goes with it —
    // and it goes to the Trash rather than anywhere else, so ⌘⇧Z (an
    // `unarchive` of the same subtree) is the way back.
    case "duplicate":
      return [{ verb: "trash", id: applied }]
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
    // NOTHING TAKES AN EMPTIED TRASH BACK, and this is the only entry here
    // that answers so because the WORLD has no inverse rather than because
    // this surface cannot spell one. `unmirror` above is the other silent
    // arm, and its silence is about the shape of a placement verb; this one
    // is about the records being gone from the set. What still has them is
    // git, to exactly the extent git had already recorded them, and that is a
    // thing somebody does in a terminal — a ⌘Z that quietly re-read a commit
    // would be inventing a restore this app does not have. The fence is the
    // confirm the Trash page asks before the write, which says so in as many
    // words.
    case "emptyTrash":
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
    // with no inbox mints `_olai/Inbox.olai`, and its ⌘Z takes the LINE back
    // and leaves the file — an empty inbox behind the sidebar's Inbox entry,
    // which is a thing a reader can see, rather than a file quietly appearing
    // and disappearing.
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
 *  refuse in its own words.
 *
 *  A body the SET DOES NOT KEEP (`@olai/format`'s `kinds.ts`) answers nothing
 *  here for the same reason and by the same rule: there is no text in this
 *  reading to put back. It is not a case that arises — this edit is a `.md`'s
 *  and the kinds that are not kept are the ones no op writes — and it is
 *  spelled rather than assumed, because the alternative is an undo carrying an
 *  empty file. */
const documentTextOf = (
  at: Reading,
  edit: Extract<Edit, { verb: "doc" }>,
): ReadonlyArray<Edit> => {
  const document = markdownAt(at.set, edit.file)
  if (document === undefined) return []
  return [{ verb: "doc", file: edit.file, text: document.body, was: edit.text }]
}

/** Where a row about to be archived sits, as the unarchive that would bring it
 *  back there — and nothing at all for an id this reading does not hold or for
 *  a placement, which the archive itself is about to refuse. */
const unarchiveOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return []
  const parent = located.node.parent
  return [{
    verb: "untrash",
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
 * The REPEAT RULE a node carries, as the edit that would put it back —
 * {@link dateOf} one field along, and the same three sentences apply to it
 * word for word: nothing for an id this reading does not hold or for a mirror,
 * and both directions in one arm, so a rule set over nothing is put back as
 * nothing and `Stop repeating` is a thing a person can take back.
 *
 * It is a separate function rather than {@link dateOf} taught a field name,
 * because the two answer about different fields of the record and a shared one
 * would take a key to index by — which is the shape `propOf` has and this is
 * deliberately not: a system field has a name at compile time.
 */
const repeatOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return []
  return [{ verb: "repeat", id, repeat: located.node.repeat ?? null }]
}

/**
 * What one custom property holds, as the edit that would put it back.
 *
 * {@link dateOf} with a key, and the resemblance is the point: both answer for
 * a value that is not there, so a property added where there was none is undone
 * by removing it — which is what makes the drawer's `Remove` a thing a person
 * can take back rather than a one-way door.
 *
 * A key holding a LIST answers as nothing, which is honest rather than
 * reachable: `set_prop` writes text, so a `prop` edit can only ever be about a
 * key holding some. If one ever arrives about a list, the undo declines to
 * spell it rather than flattening a set of values into a string nobody wrote.
 */
const propOf = (
  derived: Derived,
  id: string,
  key: string,
): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return []
  const held = customOfNode(located.node)[key]
  // A LIST, and there is NO inverse for one. `set_prop` writes text, so an undo
  // that spelled a list would have to flatten three values into one string with
  // commas in it — and the arm that used to be here did something quieter and
  // worse: `customText` answers `undefined` for a list, so `?? null` turned the
  // undo of a removal into a SECOND removal, and the value the menu had just
  // deleted was gone with nothing to say so (found by Grok, review of #179).
  //
  // Nothing is a truthful answer here where a wrong edit is not: an undo with
  // no inverse is not recorded, so ⌘Z walks past it to the write before rather
  // than pretending to put something back. `docs/editing.md` says so, and the
  // menu can only reach this at all for a list somebody wrote by hand.
  if (held !== undefined && typeof held !== "string") return []
  return [{ verb: "prop", id, key, value: held ?? null }]
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
 *
 * WHAT IT DOES NOT PUT BACK IS A RECURRENCE, and that is the feature's own
 * ruling rather than a gap here. Completing a repeating node hands its rule to
 * the occurrence it spawns (`@olai/ops`' `recurring`), so undoing the mark
 * leaves a node with no rule and a fresh occurrence standing below it — which
 * is a recurrence with exactly one live head, which is what a recurrence has.
 * An undo that took the rule back would give it TWO, and one that also deleted
 * the occurrence would be an undo reaching a node this write did not name.
 * Stopping the new one, or the old one, is `Stop repeating` on whichever row
 * the person meant (docs/format.md's Days).
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
