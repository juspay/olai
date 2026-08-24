/**
 * Editing a property IN PLACE: what a chip is being edited as, and whether
 * committing it would write anything at all.
 *
 * The pure half of `./PropsDrawer.tsx`'s editor, beside `./drawer.ts` (which
 * chips there are) and `./door.ts` (where one goes when pressed). Three small
 * decisions live here rather than inside a component because each of them is
 * the kind that goes quietly wrong: what counts as a change, what an empty box
 * MEANS, and which gesture is a write and which is a way out.
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
 */
export const writes = (was: Editing | null, key: string, value: string): boolean => {
  const sent = sending(was, key, value)
  if (was === null) return sent.key !== "" && sent.value !== ""
  return value !== was.value
}
