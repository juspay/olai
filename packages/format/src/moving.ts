/**
 * WHETHER A ROW CAN GO WHERE SOMEBODY IS POINTING — and, when it cannot, the
 * sentence that says why.
 *
 * The move-to picker searches the WHOLE SET, so some of what it finds is
 * somewhere the row cannot go: the Trash, or somewhere this row already draws.
 * Nothing is hidden — a reader typing a title they can see must find it — so
 * every hit is drawn and the ones that cannot take the row say so.
 *
 * ANOTHER OUTLINE IS NOT ONE OF THEM ANY MORE, and that is the change worth
 * naming here because this module was most of the fence: `move_node` carries a
 * row and everything under it into another outline, ids intact
 * (`@olai/ops`' `planMove`), so a destination in another file is an ordinary
 * destination and this reading has nothing to say about it. What survives is
 * the FORMAT's own rule, which was never this one: a record's `parent` names a
 * record of its own file (./rules.ts's `foreign-parent`) — and it goes on
 * holding, because what crosses is the whole subtree rather than the link.
 *
 * ## Asked at the AIM, which is #238's shape read for a keyboard
 *
 * A drop over the wrong pane fills that pane with the reason BEFORE the hand
 * lets go (`@olai/web`'s `drag/Refusal.tsx`), because a person told no after
 * doing the work has been told too late. A list walked with the arrows has the
 * same two moments — the row under the cursor, and the `Enter` — so the reason
 * is drawn as the cursor arrives and `Enter` sends nothing.
 *
 * It is a SECOND READING and never a second POLICY, which is the whole of why
 * it is safe. Every sentence here is about a rule `planMove` enforces
 * (`@olai/ops`' `plan.ts`), the write still goes through that planner, and a
 * destination this module says nothing about can still be refused there — an id
 * that has since moved, a file that stopped parsing — and lands in the panel's
 * said line in the ops layer's own words. What it must never do is refuse
 * something the planner would allow, which is why every rule below is a fact
 * about the SET as it stands, and none of them is a guess about the write.
 *
 * ## The one walk, and the case a parent walk cannot see
 *
 * "Inside" is asked of the DRAWING graph ({@link drawnFrom}, walked by
 * {@link drawingPath}) rather than of parent links, and that is a correction
 * this reading shipped without: a parent walk answers "is the destination one
 * of my descendants", which misses the destination that a descendant PLACEMENT
 * draws. A Now section is mirrors of live work, so
 *
 *     now
 *       now-install   (a mirror of install)
 *     kitchen
 *       install
 *         handles
 *
 * offers `install` and `handles` as destinations for `now` — and moving it
 * there draws `now` inside itself for ever. The parent walk was silent, the
 * planner had no rule either, and the write gate's validator refused the SET:
 * an undimmed row, a keystroke, and a refusal about a file nobody wrote.
 *
 * One walk answers every case: the destination is inside this row's own
 * subtree, is what a placement inside it shows, or — where the row IS a
 * placement — is what this row itself shows.
 *
 * ## The current parent is refused too, and that was a decision
 *
 * It is OFFERED (finding it and not finding it is a reader hunting for a bug)
 * and REFUSED, because it is not the no-op it looks like. A `move_node` naming
 * a parent and no anchor lands the row LAST among that parent's children, so
 * picking the parent a row already has is a REORDER — silently, to the bottom
 * of a list that may be long, from a gesture that reads as "put it where it
 * already is". This app has two affordances that mean exactly that and say so
 * (`Alt+Shift+↑/↓`, and dragging), and the sentence points at them.
 *
 * ## Why it is HERE, and answered over a wire
 *
 * It was the browser's, over the browser's own copy of the vault — the last
 * gesture in the app that judged an arbitrary node of the directory against
 * another one. That copy is what `docs/brainstorming/vault-in-browser.md` takes
 * away, and this question cannot be folded into a page's reading: the
 * destination is whatever the search just answered with, which is not on the
 * page at all. So it is a reading of its own, asked of the set, re-answered per
 * revision — because a panel left standing while an agent writes must judge
 * against where the row has actually got to.
 */

import { Schema } from "effect"

import { type Derived, drawingPath, follow } from "./derive.ts"
import { chainOf } from "./errors.ts"
import { isMirror, isRegular, isTrashed } from "./node.ts"

/**
 * THE ROW BEING MOVED — one value, read off the set and handed whole to
 * everything that asks about it.
 *
 * Three of the four fields are what a destination is judged against and the
 * fourth is what the panel calls the row out loud, and they are ONE value
 * because the domain has one: "the row being moved". Passed as a judging shape
 * plus a title beside it, the two would be held together by an unenforced rule
 * (that the title is the title of what the row shows) at the one reader that
 * needs both.
 *
 * It names the row's OWN RECORD throughout, which is what the write names and
 * what the drawing walk starts from — so a mirror moves as the placement it is,
 * and what it draws is asked of the record rather than of the node it stands
 * for.
 */
export const Moved = Schema.Struct({
  /** The row's OWN record — what the write names, so a mirror moves as the
   *  placement it is and the node it stands for stays where it lives. */
  id: Schema.String,
  /** What the row SAYS: the title of the node it shows, for the one line the
   *  panel writes about what is being moved. A placement whose chain died draws
   *  no title anywhere, so it is called by the one thing it still is — its id. */
  title: Schema.String,
  /** The outline it lives in. */
  file: Schema.String,
  /** The node it sits under NOW, or `null` at the top level of its file. */
  parent: Schema.NullOr(Schema.String),
})
export type Moved = typeof Moved.Type

/**
 * WHAT THE PANEL IS ASKING: which row, and which destinations to judge.
 *
 * THE DESTINATIONS ARE IDS and nothing else — never the title and file a
 * browser drew a moment ago. Both halves of a verdict are then read out of one
 * revision of one set, so a refusal cannot name a file the node has since left.
 *
 * A BATCH, because the picker judges every hit its search answered with: the
 * row under the cursor is dimmed, every other refused row is dimmed too, and
 * asking one at a time would be a round trip per arrow key.
 */
export const MovingRequest = Schema.Struct({
  record: Schema.String,
  to: Schema.Array(Schema.String),
})
export type MovingRequest = typeof MovingRequest.Type

/** What the set says about the move: the row as it stands, and a verdict per
 *  destination IN THE ORDER ASKED — `null` for one that can take the row. */
export const MovingAnswer = Schema.Struct({
  /** `null` for a record the set no longer declares — another writer archived
   *  it, somebody deleted it — which is what closes the panel rather than
   *  leaving it pointing at nothing. */
  moved: Schema.NullOr(Moved),
  refusals: Schema.Array(Schema.NullOr(Schema.String)),
})
export type MovingAnswer = typeof MovingAnswer.Type

/** An answer about nothing: no row, and no verdicts. What a request with no
 *  record standing behind it comes back as. */
export const NOT_MOVING: MovingAnswer = { moved: null, refusals: [] }

/** Whether two answers say the same thing — derived from the schema, for the
 *  reason `./shelf.ts`'s `sameShelf` is: a hand-written comparison is these
 *  fields spelled twice, and the field that got forgotten would be a panel
 *  holding a verdict the directory has moved past. */
export const sameMoving: (a: MovingAnswer, b: MovingAnswer) => boolean = Schema
  .toEquivalence(MovingAnswer)

/** …and whether two REQUESTS ask the same thing, on the same terms and for the
 *  mirror-image reason: a browser holds this one open as a subscription while a
 *  panel stands (`@olai/web`'s `move/moving.tsx`), and an input rebuilt without
 *  this would tear the stream down and blank the answer every time another
 *  writer moved the row — asking again for exactly what it was already
 *  watching. */
export const sameMovingRequest: (a: MovingRequest, b: MovingRequest) => boolean =
  Schema.toEquivalence(MovingRequest)

/** The whole answer, over one revision of one set. */
export const movingOf = (derived: Derived, request: MovingRequest): MovingAnswer => {
  const located = derived.byId.get(request.record)
  if (located === undefined) return NOT_MOVING
  // The TITLE is the one thing here that is about the node a row SHOWS rather
  // than about its record, so it is the one thing `follow` is asked for.
  const shown = follow(derived, located)
  const moved: Moved = {
    id: located.node.id,
    title: shown.kind === "found" ? shown.shows.node.title : request.record,
    file: located.file,
    parent: located.node.parent ?? null,
  }
  return {
    moved,
    refusals: request.to.map((id) => {
      const to = derived.byId.get(id)
      // A destination the set does not declare — and a PLACEMENT, which the
      // picker never offers because its search answers with nodes — is one this
      // reading says nothing about: the planner is what answers, in its own
      // words, and a refusal invented here would be a fence.
      return to === undefined || !isRegular(to) ? null : whyNot(moved, {
        id,
        title: to.node.title,
        file: to.file,
      }, derived)
    }),
  }
}

/** A node the search offered, in the three fields a verdict reads. */
export interface Destination {
  readonly id: string
  readonly title: string
  readonly file: string
}

/**
 * Why this destination cannot take this row — or `null` when it can.
 *
 * The ORDER of the tests is what a reader gets told, and each one is in front
 * of the ones it would otherwise be answered by:
 *
 *   - the row ITSELF first, because every other sentence would be true of it
 *     and none of them would be the news;
 *   - the TRASH before the drawing walk, because that is the planner's own
 *     order (`planMove` asks whether the move crosses into or out of a trash
 *     before it asks about loops), and this previews the planner rather than
 *     out-ruling it. It is the ONE thing left here that another outline can be:
 *     an archive is an outline like any other to a search, and the sentence for
 *     it is about the Trash rather than about files;
 *   - the DRAWING walk before the current-parent rule, because a destination
 *     that would fold the branch into itself is the news whether or not it also
 *     happens to be where the row already hangs.
 */
export const whyNot = (
  moved: Moved,
  to: Destination,
  derived: Derived,
): string | null => {
  if (to.id === moved.id) {
    return `\`${to.title}\` is the row you are moving — nothing can go under itself.`
  }
  if (isTrashed(to.file)) {
    return `\`${to.title}\` has been put away — the Trash holds what is finished ` +
      `with, and nothing is moved INTO it. \`Put back\` is how something comes out.`
  }
  const drawn = drawingPath(derived, moved.id, to.id)
  if (drawn !== null) return insideItself(derived, to, drawn)
  if (to.id === moved.parent) {
    return `\`${to.title}\` is already this row's parent. A destination puts the row ` +
      `LAST under it, so picking this one would reorder rather than move — ` +
      `Alt+Shift+↑/↓ and dragging are the two ways to say that.`
  }
  return null
}

/**
 * The sentence for a destination this row already draws — TWO of them, because
 * they are two different mistakes and only one of them is visible on the page.
 *
 * A chain of plain parent links is a destination the reader can SEE under the
 * row they are moving, and saying so is enough. A chain through a PLACEMENT is
 * a destination that may be three branches away on screen, and the reader has
 * no way to know what this row draws — so that one names the chain, in the
 * spelling `chainOf` gives every other refusal about a loop in this codebase.
 */
const insideItself = (
  derived: Derived,
  to: Destination,
  drawn: ReadonlyArray<string>,
): string => {
  const through = drawn.some((id) => {
    const at = derived.byId.get(id)
    return at !== undefined && isMirror(at.node)
  })
  return through
    ? `\`${to.title}\` is drawn inside this row, through a placement — ${
      chainOf(drawn)
    } — so putting it there would make the page draw itself for ever.`
    : `\`${to.title}\` is inside the row you are moving, so this would fold the ` +
      `branch into itself.`
}
