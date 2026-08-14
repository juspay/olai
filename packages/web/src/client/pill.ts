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

/**
 * Its opposite number: the verb that GOES AHEAD with the one thing a confirm
 * is asked about.
 *
 * Two sites wear it, and they are the same question in two boxes — the `•••`
 * menu's `Move to Trash` and the ⌘K palette's. It is the quiet pill's twin in
 * every measurement and differs only in tone, which is the whole of what it
 * says: this is the answer that does the thing, and the pill beside it (the
 * quiet one) is the way out. So the two are declared together, because a
 * confirm whose two buttons stopped matching is a confirm that reads as a
 * layout accident.
 *
 * `bg-transparent` IS here, unlike its neighbour: the hover fill is a tint of
 * the alarm colour, so the resting state has to say it has none.
 */
export const ALARM_PILL =
  "rounded border border-alarm bg-transparent px-2 py-1 text-xs text-alarm hover:bg-alarm/10"
