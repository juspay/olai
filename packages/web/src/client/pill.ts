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
 * No background here on purpose: Tailwind's preflight already paints a button
 * transparent, so a `bg-transparent` in this string would be that fact
 * spelled in a second place. And no cursor either — whether a pointer is
 * offered belongs to the surface the button sits on (the menu panel says
 * `cursor-pointer` beside this; chrome does not).
 *
 * Two buttons LOOK like this one and are deliberately not it, each holding a
 * geometry of its own: the ask form's "dismiss" is h-8/px-3 because it stands
 * beside an accent "answer" of the same height, and the Push on the unpushed
 * line is py-0.5 because it sits inside a line of text rather than under one.
 * Converging either would move pixels, which is a different change from
 * unifying a spelling — each says so where it diverges.
 */
export const QUIET_PILL =
  "rounded border border-rule px-2 py-1 text-xs text-muted hover:text-ink"
