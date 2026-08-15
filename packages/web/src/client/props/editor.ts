/**
 * The property editor's pure half: what it is editing, what its button says,
 * and whether pressing it would write anything.
 *
 * Beside `../date/pick.ts`, which is the same file for the same panel one field
 * over — the rules a person can get wrong belong in a function with a test, and
 * what is left in the component is a form.
 */

/**
 * What the editor was opened ON: a property that exists, or nothing.
 *
 * A `key` with no `value` is not spellable, which is the point of the pair
 * being one value: an editor "on `pr`" always knows what `pr` currently says,
 * because that is what it puts in the box.
 */
export interface Editing {
  readonly key: string
  readonly value: string
}

/** The button, in the one state it has: what it says, and whether it does
 *  anything. Derived together so the two cannot disagree — `../date/pick.ts`'s
 *  rule, and it is the same button. */
export interface Press {
  readonly label: string
  readonly writes: boolean
}

/**
 * THE KEY IS FIXED WHILE EDITING, and that is a decision rather than an
 * omission — the prototype let both fields be typed in.
 *
 * A rename is not a write this format has: `set_prop` sets ONE key, so changing
 * `pr` to `PR` is taking one property off and putting another on, which is two
 * ops. Letting the box do it would either leave the old key behind (one op,
 * wrong) or send two writes for one gesture (the deviation HACKING.md forbids —
 * a person's gesture must be an op an agent can make). So the drawer offers
 * exactly what the tool offers: add a property, change what one holds, remove
 * one. A rename is the two of those, in the order the reader chooses.
 */
export const pressOf = (was: Editing | null, key: string, value: string): Press => ({
  label: was === null ? "Add property" : "Save",
  // A key that is nothing but space is not a key (the ops layer refuses it in
  // those words); the button is simply dead rather than sending a write to be
  // told so. Changing NOTHING is dead too — the same rule the date picker's
  // button follows, and the reason both are read off the record rather than off
  // the box alone.
  writes: key.trim() !== "" && (was === null || value !== was.value),
})
