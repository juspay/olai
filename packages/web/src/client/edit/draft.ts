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
 */

import type { Anchor, Edit } from "@olai/surface"

/** The row a draft is editing, and which of its two texts. */
export interface Editing {
  readonly kind: "row"
  /** The PLACE (`Row.key`): where the editor is drawn. The same node reached
   *  through two mirrors is two rows, and only one of them is being typed in. */
  readonly place: string
  /** The node whose text this is — what the row SHOWS, so editing a mirror
   *  edits the node it stands for, which is what a mirror is for. */
  readonly id: string
  readonly field: "title" | "desc"
  /** What is in the editor. */
  readonly text: string
  /** What was in it when the editor opened, or after the last commit that
   *  landed. The comparison that keeps an idle timer from writing a file that
   *  already says this. */
  readonly saved: string
}

/** A row that does not exist yet: an editor standing where it will go. */
export interface Pending {
  readonly kind: "new"
  /** Where the row goes, in the surface's own terms. */
  readonly at: Anchor
  /** The PLACE the editor is drawn after — `null` for the first row of an
   *  outline that has none, which is drawn at the top of the tree. */
  readonly place: string | null
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
    ? { verb: "retitle", id: draft.id, title: draft.text }
    : // An emptied note is a note removed, which is what `null` spells — not a
      // note whose text is the empty string.
      { verb: "note", id: draft.id, desc: draft.text === "" ? null : draft.text }
}

/** The same draft with what has just been typed in it. */
export const typed = (draft: Draft, text: string): Draft => ({ ...draft, text })

/** The draft as it reads after a commit that LANDED: the text becomes what is
 *  saved, so the next idle tick has nothing to say. A pending row becomes the
 *  row it just created — `id` is the one the set gave it — which is what keeps
 *  the caret in the line that was typed. */
export const landed = (draft: Draft, id: string): Editing =>
  draft.kind === "new"
    ? {
      kind: "row",
      // Where the new row will be drawn: a sibling takes the anchor's place,
      // one segment along; a first child hangs under it. Keys are minted by
      // the format's own walk (`Row.key`), and this is the one place the
      // client spells one — it is how the editor follows a row it has just
      // asked for onto the screen, a frame before the set arrives.
      place: placeOf(draft, id),
      id,
      field: "title",
      text: draft.text,
      saved: draft.text,
    }
    : { ...draft, saved: draft.text }

/** The `Row.key` a row added by this draft will be drawn at. A key is the
 *  chain of ids from the root of the page, `/`-joined, so a sibling shares
 *  everything but the last segment and a child appends one. */
const placeOf = (draft: Pending, id: string): string => {
  if (draft.at.kind === "under") return `${draft.place ?? ""}/${id}`
  if (draft.place === null) return `/${id}`
  return `${draft.place.slice(0, draft.place.lastIndexOf("/"))}/${id}`
}

/** Where the NEXT row goes when this draft is followed by `Enter`. A row that
 *  has just been added is what the next one follows; a row being edited is
 *  followed by a new sibling of its own. */
export const after = (draft: Editing): Anchor => ({ kind: "after", id: draft.id })

/**
 * WHICH EDITOR a draft is drawn in: the place, and which of the three things
 * it is. Two draft values with the same slot are the same box on screen with
 * different text in it, which is exactly the question a blur has to ask.
 *
 * It exists because a blur arrives LATE. `Enter` unmounts the editor it was
 * pressed in and opens the next one, and the browser then delivers a `blur`
 * from the element that went away — so a blur that closed "the draft" would
 * close the row the same keystroke had just opened. Naming the slot it came
 * from makes that a comparison rather than a race.
 */
export interface Slot {
  readonly place: string | null
  readonly field: "title" | "desc" | "new"
}

export const slotOf = (draft: Draft): Slot =>
  draft.kind === "new"
    ? { place: draft.place, field: "new" }
    : { place: draft.place, field: draft.field }

export const sameSlot = (a: Slot, b: Slot): boolean =>
  a.place === b.place && a.field === b.field
