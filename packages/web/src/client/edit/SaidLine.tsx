/**
 * What a write SAID, drawn — the one place the two moods are read.
 *
 * Five surfaces in this client say something about a write, and by the time
 * the palette became the fifth they had each spelled the same four lines: the
 * alarm/muted colour pair, the `data-tone` fact, and the `role` / `aria-live`
 * pair that decides whether a screen reader is interrupted. Five copies of one
 * decision is five chances for the next surface to alarm about a nudge — and
 * the rule those lines encode is not a look, it is what {@link Said}'s two
 * moods MEAN:
 *
 *   - a REFUSAL is why nothing happened. It is toned alarm and announced
 *     assertively, because a reader who does not notice it believes a write
 *     landed that did not (HACKING.md's error rule).
 *   - a REMARK rides back on a write that DID land. It is toned quietly and
 *     announced politely, because interrupting what a screen reader is already
 *     saying to deliver advice is worse than the advice is worth.
 *
 * WHAT IT DOES NOT OWN IS WHERE THE LINE SITS. That is the one thing the five
 * genuinely differ about — a popover beside the `•••`, a banner pinned under
 * the header, a row inside the palette, a line under a picker, a line under a
 * trash row — so the container's classes are the caller's and this adds the
 * mood to them. Unifying the layout too would be the complecting the split
 * avoids: one component with a `where` enum is five layouts behind one flag.
 *
 * `data-tone` is a FACT IN THE MARKUP rather than a colour, and that is why
 * the suite can ask which mood a line is in (`support/said.ts`) without asking
 * about a class name.
 */

import type { Said } from "./undoing.ts"

export function SaidLine(props: {
  readonly said: Said
  /** Where this line sits, and how it is boxed — the caller's. */
  readonly class?: string
  readonly testid: string
}) {
  return (
    <p
      class={props.class}
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
