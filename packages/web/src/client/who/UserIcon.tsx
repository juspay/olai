/**
 * THE SILHOUETTE — the bottom rung of `@olai/identity`'s picture ladder, drawn.
 *
 * The ladder answers `null` when no rung had a picture (no proxy avatar, no
 * operator template, no gravatable email claim), and `null` is not an error: it
 * is a face like any other, and this is that face. It is also what ANONYMOUS
 * wears, and what the header draws while the door has not answered yet — one
 * shape for "a person, and no picture of them", so a reader does not have to
 * learn three.
 *
 * ## Its own file because it is drawn in two places now
 *
 * It began inside {@link ./Who.tsx} as the header chip's fallback. The
 * transcript now names the speaker of every run of messages, and the person is
 * one of the three ({@link ../chat/Speaker.tsx}) — resolved down the SAME
 * ladder, through the same one ask ({@link ./mine.ts}), because a header saying
 * one thing about who is looking and a transcript saying another would be two
 * answers to one question. A second silhouette traced beside this one would be
 * the same drift one layer down: two outlines that are nearly the same shape,
 * and nobody can tell which of them they are looking at.
 *
 * The SIZE is the caller's, because the two callers are at two scales — a chip
 * in a fixed-height bar, and a mark on a line of transcript. Everything else is
 * fixed here: the stroke language is `../Leaf.tsx`'s, and `currentColor` is
 * implied by `stroke="currentColor"`, so the icon takes the colour of whatever
 * line it sits on and is legible in both themes with no palette of its own.
 *
 * `aria-hidden`, always: everywhere it is drawn the person is NAMED beside it
 * or in the label of the control around it, so a second copy in the accessible
 * name would be the same word twice.
 */

export function UserIcon(props: { readonly class: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      class={props.class}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.2c1.3-3.2 3.6-4.7 6.5-4.7s5.2 1.5 6.5 4.7" />
    </svg>
  )
}
