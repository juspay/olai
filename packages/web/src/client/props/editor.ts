/**
 * Editing a property IN PLACE: what a chip is being edited as, and whether
 * committing it would write anything at all.
 *
 * The pure half of `./PropsDrawer.tsx`'s editor, beside `./drawer.ts` (which
 * chips there are) and `./door.ts` (where one goes when pressed). Four small
 * decisions live here rather than inside a component because each of them is
 * the kind that goes quietly wrong: what counts as a change, what an empty box
 * MEANS, which gesture is a write and which is a way out — and whether the
 * box is still LISTENING for one at all.
 *
 * ## An empty value REMOVES the property
 *
 * That is not this file's invention and it is not a convenience: it is what the
 * op already does. `set_prop` with `""` and `set_prop` with `null` both take
 * the key off (`@olai/ops`' plan, and `@olai/format`'s `withCustom` under it —
 * "a key holding `""` and a key that is gone are one file on disk"). So the
 * face offers exactly what the tool offers: clear the box and the property is
 * gone, which is the same write an agent makes and lands in the same undo.
 *
 * A person's gesture must be an op an agent can make (HACKING.md), and this is
 * that rule read the other way round — the removal verb did not need inventing,
 * it needed exposing.
 *
 * ## The key is fixed while a value is being changed
 *
 * A rename is not a write this format has: `set_prop` sets ONE key, so changing
 * `pr` to `PR` is taking one property off and putting another on, which is two
 * ops. An editable key box would either leave the old key behind (one op,
 * wrong) or send two writes for one gesture. So a chip's key is typed exactly
 * once — when the property is being ADDED — and after that the only way to
 * rename is to clear one and add another, which is the two ops spelled as the
 * two gestures.
 *
 * ## Nothing to write is not a refusal
 *
 * Opening a chip, touching nothing and clicking away must not send anything.
 * The ops layer would refuse it in good words ("it already holds that"), and an
 * affordance that leads to a refusal is worse than none — the rule the node
 * menu already follows for the node's own fields. So {@link writes} is asked
 * first, and a commit with nothing to say just closes.
 */

/**
 * What the editor was opened ON: a property that exists, or `null` for one
 * being added.
 *
 * A `key` with no `value` is not spellable, which is the point of the pair
 * being one value: an editor "on `pr`" always knows what `pr` currently says,
 * because that is what it puts in the box.
 */
export interface Editing {
  readonly key: string
  readonly value: string
}

/** What a commit would send — the key trimmed, because a key is a name and the
 *  space around one is nobody's. The value is NOT trimmed: it is somebody's
 *  text, and a sentence that ends in a space is still that sentence. */
export const sending = (
  was: Editing | null,
  key: string,
  value: string,
): { readonly key: string; readonly value: string } => ({
  key: (was === null ? key : was.key).trim(),
  value,
})

/**
 * Would committing this write anything?
 *
 * Three answers, and each is a case somebody reaches by accident:
 *
 *   - a NEW property with no key is not a property. The ops layer refuses a
 *     blank key in those words; the gesture simply does nothing instead.
 *   - a NEW property with an empty value would be a removal of a key that is
 *     not there, which is the one thing `set_prop` refuses about removals. So
 *     `+`, then Escape-by-way-of-Enter, is a way out rather than a refusal.
 *   - an EXISTING property set to what it already holds is refused too, which
 *     is what makes "open a chip and click away" have to be silent.
 *
 * ## One gesture, one outcome: the close belongs to the gesture that closed it
 *
 * Enter commits and Escape abandons — and BOTH close the box, which is where
 * the ordering trap lives: the browser's answer to the focused box going away
 * is a blur, fired AT the gesture whose close this already was. Heard
 * naively, one Enter is then TWO sends of the same write, and the second is
 * what the ops layer's own no-change guard turns away: a spurious "already
 * says … — nothing would change" note drawn under the run for a gesture that
 * did exactly what it was asked (bugs.olai's `chip-blur-double-commit-2`). An
 * Escape heard twice is worse than spurious: a write the person had declined.
 *
 * So the law is one sentence long: the gesture that closes OWNS the close —
 * once a key has answered, whichever key it was, the blur its wake fires
 * stands down ({@link leavingCommits}). The leaving itself is no casualty of
 * the law: a blur that arrives FIRST is the gesture, and "leaving the box
 * commits what changed" keeps standing for exactly as long as nothing has
 * answered.
 */
export const writes = (was: Editing | null, key: string, value: string): boolean => {
  const sent = sending(was, key, value)
  if (was === null) return sent.key !== "" && sent.value !== ""
  // AGAINST THE SNAPSHOT the editor opened on, never against what the key holds
  // NOW — which is the difference between refusing and clobbering, and is why
  // the caller hands the snapshot back rather than rebuilding it
  // (`./PropsDrawer.tsx`'s `Chip.onCommit`).
  //
  // The trade it makes is worth naming, because it cuts the other way too (pi,
  // N3): if an agent moves the key from `A` to `B` while a chip is open and the
  // person then types the `A` they can still see, this reports nothing to write
  // and the file keeps `B`, silently. That is the same shape as the clobber and
  // the opposite outcome, and it is the one to prefer — the quiet loss is a
  // write that did not happen, where the alternative is a write that undid
  // somebody else's. Telling the two apart needs the op to carry a `was`, which
  // no face has for `prop` (`@olai/surface`'s `edit.ts`); until it does, this
  // side declines rather than guesses.
  return value !== was.value
}

/**
 * WHAT HAS ANSWERED THIS BOX, once anything has: Enter's commit, or Escape's
 * abandon. `null` while nothing has — which is the only state in which a
 * leaving is the gesture rather than the echo of one.
 *
 * One type for both editors: the chip's single box and the add chip's pair
 * answer for themselves in `./PropsDrawer.tsx`, and the law they answer to is
 * this one. THE RECORD IS BORN WITH THE OPEN: each editor holds it as a `let`
 * inside its component, and the `<Show>` that mounts the box DISPOSES the
 * component on the close, so closing is also the reset — `leavingCommits`'s
 * `null` then genuinely means "nothing has answered THIS open". An editor
 * that kept its component alive and only hid the box would owe the record a
 * reset of its own, and that is a design to refuse rather than to support:
 * the pin suite (`./editor.test.ts`'s reopen sequence, and the same chip
 * edited twice in @olai/tests' `properties.feature`) is written against it.
 */
export type ClosedBy = "enter" | "escape" | null

/**
 * Does LEAVING the box still commit — is the blur the gesture, or its echo?
 *
 * The ORDER the events arrive in is the browser's, and it is hostile: a key
 * closes the box, and removing the focused box FIRES the blur at the gesture
 * whose close that already was. So the box listens for the gesture only while
 * none has answered, and the first key to answer owns the close: the blur its
 * wake fires stands down. What used to make the `enter` row the exception —
 * one Enter heard twice, the second send drawn as the no-change guard's
 * "already says … — nothing would change" note (`chip-blur-double-commit-2`,
 * and the add chip's focus-out answered the same law without it being the one
 * filed) — was the absence of this record, not a rule somebody preferred.
 *
 * And the record is not one way of answering the question; it is the ONLY
 * place an answer can exist. An unmount-blur is BYTE-IDENTICAL to a person's
 * click-away at handler time: same `relatedTarget` (`null`), same
 * `activeElement` (`BODY`), and the target still connected — the browser
 * unfocuses BEFORE it detaches (Opus's probe on the PR, chromium: the answer
 * measured, not assumed). No cheaper design hides in the DOM — "just ask the
 * element" is retired — so the gesture must record itself, BEFORE the close,
 * next to the close that owns it.
 *
 * What `null` must then also carry are the closes that have NO gesture, and
 * they are named here rather than inherited:
 *
 *   - the WINDOW losing focus mid-edit: the blur commits the box as-is, half-
 *     typed and all, because it cannot be told from the person leaving — and
 *     a leaving that ATE a half-typed fact would be the worse surprise. On
 *     the ADD chip the same blur takes the typed key instead: a key with no
 *     value is nothing to write, so nothing is said either — the chip is
 *     gone with the tab's leaving, and so is what was typed into it.
 *   - the ROUTE leaving, or anything that takes the whole drawer with it:
 *     the same commit fires, and its answer has nowhere to be drawn —
 *     `saying` is disposed with the run, so the answer lands on a line that
 *     is gone (the queued `was` lane's second half: its stale-`was` refusal
 *     is the EXPECTED answer on this path, and it will have no reader).
 *   - the NODE changing under an open editor: an agent's `set_prop` dropping
 *     the key disposes the chip, and the blur commits what was typed against
 *     the OPEN-TIME snapshot — typed nothing, silent; typed something, the
 *     removed key is born again holding it. Pinned as-is in @olai/tests'
 *     `properties.feature` ("a chip whose key disappears under an open,
 *     typed editor") because that is the law's CURRENT default, not a ruling:
 *     the gate that can refuse the resurrect is a `was` riding the op — only
 *     the op can say the record moved — and that is the queued lane's
 *     business and deliberately not this record's.
 *
 * Affirming `null` for the three is not saying they are right; it is saying
 * the BLUR cannot be the one to judge them — byte-identical to a leaving,
 * each time. The one close this record answers for is the one the gesture
 * itself closed.
 */
export const leavingCommits = (closedBy: ClosedBy): boolean => closedBy === null

/**
 * IS THE EDITOR OPEN ON THIS CHIP — asked by the chip's own identity, never by
 * its bare key.
 *
 * `custom` is open all the way (`@olai/format`'s `custom.ts`), so nothing stops
 * a hand-written record from carrying a custom `date` beside the field of that
 * name — a legal record that only `set_prop` refuses to MAKE. On a page drawing
 * both halves, a bare-key comparison then matches twice: pressing the custom
 * chip's key opened a second box inside the SYSTEM `date` chip, pre-filled with
 * the custom value — a writable-looking affordance on a fact the drawer calls
 * read-only, and two `data-key="date"` boxes on one page (pi, S2).
 *
 * That is exactly the collision `PropsDrawer`'s `keyOf` namespacing exists to
 * prevent one element over, so this asks the same question the same way. An
 * editor is only ever opened from a CUSTOM chip (`Chip`'s `opens`), so its
 * namespace is known and a system chip can never be the answer.
 */
export const openedOn = (
  editing: Editing | null | undefined,
  entry: { readonly key: string; readonly system: boolean },
): Editing | undefined =>
  editing != null && !entry.system && editing.key === entry.key ? editing : undefined
