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
 * hand their refusals to `./refusals.tsx`, which is where that sentence, the
 * keying that keeps it from being read twice and this row are one thing.
 *
 * HERE, at the client's top level, for that module's own reason: fourteen
 * modules across eleven feature directories draw this line, and none of them
 * owns it. It began under `edit/` because a row's editor was the first surface
 * to need one — and was the LAST to draw it, since joining changed what a
 * screen reader is told rather than only what the markup said. The type is
 * `./saying.ts`'s, beside the six seconds a line lingers.
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
 * about a class name. `data-kind` is the same idea a level down, for the one
 * caller whose refusals have a second fact to carry — see the prop.
 */

import type { JSX } from "solid-js"

import type { Said } from "./saying.ts"

/**
 * THE ALARM'S SKIN FOR A BAND, which is the one piece of layout this file does
 * name — and it is here rather than at the panels because it is not layout.
 *
 * Three shortlist panels draw a full-width alarmed band across themselves (the
 * ⌘K palette, the header's box, the completion popup), and what they share is
 * not where it sits: it is the alarm token twice over — a rule at 40% under
 * it, the same hue at 5% behind it — beside the mono type every band in those
 * panels wears. Spelled per panel, that is the alarm's look kept in three
 * places by hand, which is the drift this component exists to end one layer
 * down; spelled here it changes once.
 *
 * WHAT IS NOT HERE IS THE PAD. A panel's gutter is set by its rows — the
 * palette's is `px-4` and the two narrower ones `px-3` — so each door appends
 * its own, and that is the one axis they genuinely differ on.
 */
export const ALARM_BAND =
  "m-0 border-b border-alarm/40 bg-alarm/5 py-2 font-mono text-xs"

export function SaidLine(props: {
  readonly said: Said
  /** Where this line sits, and how it is boxed — the caller's. */
  readonly class?: string
  /** Viewport coordinates, when the caller has portalled the line. */
  readonly style?: JSX.CSSProperties
  readonly testid: string
  /** WHICH refusal this is, when the caller's mood has a second fact under it
   *  — the row editor's line carries the ops layer's own `OpFailure` tag, so a
   *  scenario can say which rule said no rather than matching its sentence.
   *
   *  Here rather than at the one caller for `data-tone`'s reason: it is the
   *  same idea one level down. A mood is a fact in the markup instead of a
   *  colour, and a KIND is a fact in the markup instead of a sentence to
   *  parse; a line that spelled its own `<p>` to carry one would be back to
   *  hand-writing the `role`/`aria-live` pair beside it. Absent everywhere
   *  else, because a refused query has no tag to give — `@olai/format`'s
   *  `Refusal` is a token and a reason. */
  readonly kind?: string
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
      data-kind={props.kind}
      role={props.said.tone === "alarm" ? "alert" : "status"}
      aria-live={props.said.tone === "alarm" ? "assertive" : "polite"}
    >
      {props.said.text}
    </p>
  )
}
