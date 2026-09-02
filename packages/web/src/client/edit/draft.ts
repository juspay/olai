/**
 * The draft cell: the one piece of state in this client that is not the
 * server's, and the reason it is allowed to exist.
 *
 * Everything a reader sees comes off the wire — that is the rule, and an
 * optimistic echo of a write is exactly what it forbids. A draft does not
 * break it, because a draft is NOT a claim about the outlines: it is the text
 * in an editor, the same way what is typed in the chat composer is. Nothing
 * here is drawn as committed state, nothing here is another tab's business,
 * and until a commit lands the file says what it always said.
 *
 * What makes that honest is the commit rule, which is this file's whole
 * subject:
 *
 *   - a draft is committed on **blur**, on **Enter**, and on going **idle** —
 *     the three moments a person has stopped typing this thought;
 *   - a commit that would change nothing sends nothing ({@link commitOf}
 *     answers `null`), so idling in a row you only looked at is not a write
 *     and not a git commit;
 *   - a commit that is REFUSED keeps the draft. The text stays where it was
 *     typed and the reason is shown beside it. That is the one property a
 *     buffer like this must have: nothing a person typed may be lost because
 *     a validator said no.
 *
 * A NEW row is a draft too, and that is the answer to "what title does an
 * empty bullet have". The ops layer refuses a node without one, and it is
 * right to: a blank record on disk is a record nobody meant. So `Enter` opens
 * an editor at the place the row will go, and the `add` lands the moment that
 * editor has text and is committed — one op, at the write gate, exactly like
 * every other edit. An abandoned empty draft writes nothing, which is the
 * correct amount of nothing for a key pressed by accident.
 *
 * TWO IDS, and the difference is the one rule the editor is built on. `row` is
 * the record the row IS — a mirror's own id — and it answers "which line on
 * screen is this"; `id` is the record the row SHOWS, and it answers "whose
 * text am I typing". They are the same for every row that is not a placement.
 * A draft carrying only one of them cannot be both followed across a move and
 * committed to the node a mirror stands for.
 */

import type { Anchor, Edit, OpFailure } from "@olai/surface"

/**
 * How long a person stops typing before what they typed is written — the third
 * of the three commit moments, and the only one that is a duration.
 *
 * Long enough that a pause mid-sentence is not a git commit, short enough that
 * walking away from the keyboard cannot lose the line. It is here rather than
 * beside the timer it drives because it is part of the RULE this file states,
 * and because a browser test asserting that a draft is NOT a write has to
 * outlast it: a negative read the instant typing stops would pass against a
 * client that wrote a moment later, which is the one thing that scenario is
 * about.
 */
export const IDLE_COMMIT = 1200

/**
 * What the last write ANSWERED WITH, whichever kind of draft it was about — a
 * refusal (which is why the text is still here) or a nudge (which is the
 * opposite: it landed, and the rollup noticed something). Shared by both arms
 * so the two readers — the commit rule and the line under the editor — need no
 * narrowing to ask a question that is about neither kind in particular.
 *
 * NOT `Said`, which it was called until `../saying.ts` became the client's one
 * home for that name: this is the two things a write can reply WITH, and a
 * `Said` is the sentence and mood one of them is then drawn as. One word, one
 * concept — and the file that turns one into the other (`./RowEditor.tsx`) had
 * both in scope at once. Not `Answered` either, which `../filter/asking.ts`
 * already uses for a search answer and its question.
 */
export interface Replied {
  /** What the last commit was refused with. It rides ON the draft rather than
   *  beside it, so replacing the draft cannot leave a stale reason on screen
   *  and nothing has to remember to clear it. */
  readonly refused?: OpFailure
  /** What the last write that LANDED had to say — the ops layer's nudge. Same
   *  ride, opposite mood: advice on a success, never a reason a write did not
   *  happen. */
  readonly nudge?: string
}

/** The row a draft is editing, and which of its two texts. */
export interface Editing extends Replied {
  readonly kind: "row"
  /** The record occupying the row — `Row.at.node.id`. What the caret follows
   *  when the tree moves under it, and what a new sibling is anchored on. */
  readonly row: string
  /** The node whose text this is — what the row SHOWS, so editing a mirror
   *  edits the node it stands for, which is what a mirror is for. */
  readonly id: string
  /** Where the editor is DRAWN (`Row.key`): the same node reached through two
   *  mirrors is two rows, and only one of them is being typed in. `null` while
   *  the row this draft is about has not been drawn yet — a row that has just
   *  been added, or one whose place changed under a move — which is what the
   *  editor's `follow` fills in from `row` on the next frame. */
  readonly place: string | null
  readonly field: "title" | "desc"
  /** What is in the editor. */
  readonly text: string
  /** What was in it when the editor opened, or after the last commit that
   *  landed. The comparison that keeps an idle timer from writing a file that
   *  already says this. */
  readonly saved: string
  /**
   * Where the caret goes when this draft's editor OPENS — absent unless a key
   * has an opinion about it, which three of them do.
   *
   * A SPLIT and a MERGE are the two whose whole point is that the caret stays
   * in the sentence: a split leaves it at the head of the half that came off, a
   * merge at the seam the two halves were joined at.
   *
   * An INDENT (`Tab`, `Shift+Tab`) has the opinion for a different reason —
   * that the caret should not move AT ALL. It changes the row's `Row.key`, so
   * the editor is not the same box moved but a new box in a new branch, and a
   * new box opens at the end of the text; somebody who indents mid-word is
   * thrown to the end of their own title. A reorder is not on the list, because
   * it keeps the key and so keeps the box, and the platform keeps the selection
   * inside it.
   *
   * A CLICK is the fourth: the offset it landed on, measured against the
   * source (`./point.ts`), because the `<input>` that will hold the caret
   * is not on the page yet. Absent is still the end of the text — the
   * filler, a note, a row handed back from the move-to picker.
   *
   * None of those is where the caret was in an editor that has gone away
   * (which nothing can read), so it is a fact the DRAFT has to carry — the
   * row it names is redrawn by a frame that arrives later, in an element
   * that does not exist yet.
   */
  readonly caret?: number
  /**
   * WHERE THIS LINE WAS BEING TYPED BEFORE IT WAS A ROW — a forwarding
   * address, set by {@link landed} on a line that did not exist yet and by
   * nothing else.
   *
   * A {@link Slot} is an ADDRESS: the row an editor is drawn at and which of
   * its texts. Every caret keeps its address for as long as it lives, with one
   * exception — a brand-new line, whose address is minted by the write that
   * lands it. The caret has gone nowhere and the words are the same; the box it
   * is drawn in is answering to an id that did not exist a moment ago.
   *
   * A blur is the one reader that has to see through that, because it commits
   * before it closes and then asks whether the editor it came from is still the
   * open one ({@link stillAt}). Asked of the new address alone the answer is
   * "the reader opened something else" about a reader who opened nothing, and
   * the click-away that wrote the line leaves the caret sitting in it.
   */
  readonly was?: Slot
}

/** A row that does not exist yet: an editor standing where it will go. */
export interface Pending extends Replied {
  readonly kind: "new"
  /** Where the row goes, in the surface's own terms — and, for `after` and
   *  `under`, what it is DRAWN after: the anchor names a row, and that row is
   *  on screen. No second field, so the two cannot disagree (they did: the
   *  anchor was the shown node and the drawing was the placement, which are
   *  two different rows under a mirror). */
  readonly at: Anchor
  readonly text: string
}

export type Draft = Editing | Pending

/** What committing this draft would ASK FOR, or `null` when it would ask for
 *  nothing. Pure, and the whole of the decision: every caller — blur, Enter,
 *  the idle timer — asks this one question rather than each deciding for
 *  itself when a write is worth making.
 *
 *  An empty TITLE is deliberately still a request. The ops layer refuses it
 *  ("a node needs a title") and the refusal is what a person needs to see;
 *  swallowing it here would leave a cleared row looking saved. */
export const commitOf = (draft: Draft): Edit | null => {
  if (draft.kind === "new") {
    return draft.text.trim() === ""
      ? null
      : { verb: "add", at: draft.at, title: draft.text }
  }
  if (draft.text === draft.saved) return null
  return draft.field === "title"
    ? { verb: "title", id: draft.id, title: draft.text }
    : // An emptied note is a note removed, which is what `null` spells — not a
      // note whose text is the empty string.
      { verb: "desc", id: draft.id, desc: draft.text === "" ? null : draft.text }
}

/** The same draft with what has just been typed in it — and with whatever the
 *  last write said dropped, because it was about the text this replaces. */
export const typed = (draft: Draft, text: string): Draft => ({
  ...draft,
  text,
  refused: undefined,
  nudge: undefined,
})

/** The draft as it reads after a commit that LANDED: the text becomes what is
 *  saved, so the next idle tick has nothing to say. A pending row becomes the
 *  row it just created — `id` is the one the set gave it, and it is its own
 *  placement, a brand-new node being nobody's mirror — with no place yet,
 *  because the row it names is a frame away from being drawn, and carrying the
 *  slot it was typed at, because that is the address anything still holding
 *  this caret knows it by ({@link Editing.was}). A row that was already a row
 *  keeps none of that: its address never moved, so there is nothing to forward
 *  and a stale one is a question nobody should be able to ask. */
export const landed = (draft: Draft, id: string, nudge?: string): Editing =>
  draft.kind === "new"
    ? {
      kind: "row",
      row: id,
      id,
      place: null,
      field: "title",
      text: draft.text,
      saved: draft.text,
      was: slotOf(draft),
      nudge,
    }
    : { ...draft, saved: draft.text, refused: undefined, was: undefined, nudge }

/** The same draft, holding what the write refused with. */
export const refused = (draft: Draft, failure: OpFailure): Draft => ({
  ...draft,
  refused: failure,
})

/**
 * After a write that keeps the caret: THIS draft, with what the write said —
 * or nothing, if the reader already let go.
 *
 * Identity, the same check {@link landed}'s caller already makes. A cancel
 * replaces the object with `null`, and `current ?? held` used to put the
 * abandoned draft back. That is how Escape after a completion bounced the
 * editor open (`input_widgets.feature:209`): the placement had landed on
 * disk, Escape closed the line, and the in-flight `setDraft` resurrected it.
 *
 * Three arguments because the question is about TWO drafts — the one the
 * write left, and the one that is open now — plus what the write said.
 * {@link typed} and {@link refused} rewrite one draft; this one decides
 * whether to keep it. Slot forwarding (`was` / {@link stillAt}) is
 * {@link landed}'s, and a caller that needs both composes them. There is
 * no overload.
 */
export const kept = (
  current: Draft | null,
  held: Draft,
  nudge?: string,
): Draft | null => {
  if (current !== held) return current
  return nudge === undefined || held.kind !== "row" ? held : { ...held, nudge }
}

/** Where the NEXT row goes when this draft is followed by `Enter`: after the
 *  ROW, not after the node it shows. `Enter` on a mirror makes a sibling of
 *  the mirror — the line appears where the reader is looking — rather than a
 *  sibling of the node it stands for, somewhere else entirely. */
export const after = (draft: Editing): Anchor => ({ kind: "after", id: draft.row })

/**
 * WHICH EDITOR a draft is drawn in: the row, and which of the three things it
 * is. Two draft values with the same slot are the same box on screen with
 * different text in it, which is exactly the question a blur has to ask.
 *
 * It exists because a blur arrives LATE. `Enter` unmounts the editor it was
 * pressed in and opens the next one, and the browser then delivers a `blur`
 * from the element that went away — so a blur that closed "the draft" would
 * close the row the same keystroke had just opened. Naming the slot it came
 * from makes that a comparison rather than a race, and the slot is minted at
 * the DOM site rather than read from the signal for the same reason: what
 * blurred is what that element was drawn for, not what is current now.
 */
export interface Slot {
  readonly row: string | null
  readonly field: "title" | "desc" | "new"
}

export const slotOf = (draft: Draft): Slot =>
  draft.kind === "new"
    ? { row: anchorRow(draft.at), field: "new" }
    : { row: draft.row, field: draft.field }

export const sameSlot = (a: Slot, b: Slot): boolean =>
  a.row === b.row && a.field === b.field

/**
 * Whether this draft is the editor `from` names — the question asked AFTER a
 * commit, where {@link sameSlot} alone is not enough.
 *
 * Two ways to be it. The ordinary one is the slot the draft is drawn at now.
 * The other is the forwarding address a landed line carries
 * ({@link Editing.was}): committing a brand-new line replaces the draft with
 * the ROW it wrote, at an id that did not exist when the blur was delivered, so
 * the caret that never moved answers to a slot nobody outside this module has
 * heard of.
 *
 * Slots alone said no to that, and what it cost was the whole of the
 * click-away: the line was written and the caret stayed in the row it had just
 * made, because the blur that committed it decided the reader had gone
 * somewhere else.
 */
export const stillAt = (draft: Draft, from: Slot): boolean =>
  sameSlot(slotOf(draft), from) ||
  (draft.kind === "row" && draft.was !== undefined && sameSlot(draft.was, from))

/** The row a pending draft is drawn after, and `null` for the one that is
 *  drawn on a page's own start line — an outline with no rows to follow. */
export const anchorRow = (at: Anchor): string | null =>
  at.kind === "after" ? at.id : null

/** Whether two anchors name the same place. What a start line asks to know
 *  whether the open pending draft is the one IT offered. */
export const sameAnchor = (a: Anchor, b: Anchor): boolean =>
  a.kind !== b.kind
    ? false
    : a.kind === "first"
    ? a.file === (b as typeof a).file
    : a.id === (b as typeof a).id
