/**
 * The quiet pill button: a bordered verb beside something louder.
 *
 * Three sites wear it — the chat header's "chats" and "+ new", and the menu
 * confirm's Cancel — and they are the same button: a small action a reader
 * should not notice until they go looking for one, drawn as a border, no
 * fill, and muted text that inks on hover. One spelling, because the day this
 * button changes it must change everywhere at once; `claims.test.ts` sweeps
 * for the spelling so a fourth site copies the constant rather than the
 * string.
 *
 * Not `readout.ts`'s PILL — that is the app bar's rounded-full readout chip;
 * this is the bordered BUTTON. Two constants, because they are two shapes
 * that change for two different reasons.
 *
 * No background in this string: Tailwind's preflight already paints a button
 * transparent, so a `bg-transparent` here would say nothing. And no cursor —
 * whether a pointer is offered belongs to the surface the button sits on
 * (the menu panel says `cursor-pointer` beside this; chrome does not).
 *
 * Buttons that LOOK like this one but keep a geometry of their own — the ask
 * form's dismiss, the unpushed line's Push — say why in place: converging
 * them would move pixels, which is a different change from unifying a
 * spelling.
 */
export const QUIET_PILL =
  "rounded border border-rule px-2 py-1 text-xs text-muted hover:text-ink"
