/**
 * What this client SAID, drawn — the one place the two moods are read.
 *
 * A dozen surfaces here say something to the reader, and each of them had
 * spelled the same four lines by hand: the alarm/muted colour pair, the
 * `data-tone` fact, and the `role` / `aria-live` pair that decides whether a
 * screen reader is interrupted. A copy per surface is a chance per surface for
 * the next one to alarm about a nudge — and the rule those lines encode is not
 * a look, it is what {@link Said}'s two moods MEAN:
 *
 *   - a REFUSAL is why nothing happened. It is toned alarm and announced
 *     assertively, because a reader who does not notice it believes something
 *     happened that did not (HACKING.md's error rule).
 *   - a REMARK rides back on something that DID happen. It is toned quietly and
 *     announced politely, because interrupting what a screen reader is already
 *     saying to deliver advice is worse than the advice is worth.
 *
 * WHAT HAPPENED is not only a WRITE, and that is the second reading of the
 * same two moods. A question can be refused as well: the filter bar, the ⌘K
 * palette and the header's box each have to say why a list is empty — an
 * operator the grammar cannot read, a call that fell over — and a reader who
 * does not notice believes the directory is empty. Same mood, same markup, so
 * the same line — and the three doors do not even reach it themselves: they
 * hand their refusals to `../refusals.tsx`, which is where that sentence, the
 * keying that keeps it from being read twice and this row are one thing.
 *
 * WHAT IT DOES NOT OWN IS WHERE THE LINE SITS. That is the one thing the
 * surfaces genuinely differ about — a popover beside the `•••`, a banner
 * pinned under the header, a ruled band across the palette, a line under a
 * picker, a line under a trash row — so the container's classes are the
 * caller's and this adds the mood to them. Unifying the layout too would be
 * the complecting the split avoids: one component with a `where` enum is a
 * dozen layouts behind one flag.
 *
 * `data-tone` is a FACT IN THE MARKUP rather than a colour, and that is why
 * the suite can ask which mood a line is in (`support/said.ts`) without asking
 * about a class name.
 */

import type { JSX } from "solid-js"

import type { Said } from "./undoing.ts"

export function SaidLine(props: {
  readonly said: Said
  /** Where this line sits, and how it is boxed — the caller's. */
  readonly class?: string
  /** Viewport coordinates, when the caller has portalled the line. */
  readonly style?: JSX.CSSProperties
  readonly testid: string
}) {
  return (
    <p
      class={props.class}
      style={props.style}
      classList={{
        "text-alarm": props.said.tone === "alarm",
        "text-muted": props.said.tone === "aside",
      }}
      data-testid={props.testid}
      data-tone={props.said.tone}
      role={props.said.tone === "alarm" ? "alert" : "status"}
      aria-live={props.said.tone === "alarm" ? "assertive" : "polite"}
    >
      {props.said.text}
    </p>
  )
}
