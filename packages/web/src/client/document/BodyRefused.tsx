/**
 * Why a served file is not on screen — the sentence, wherever that file is
 * drawn.
 *
 * One element, because it is one sentence (`BODY_REFUSED`) and one mood
 * (`alarm`). A document page, a `doc` line, a day's note and a saved page
 * all have this to say, and four copies of the markup were four answers to
 * whether a refusal is italic, muted, or a span, while the testid and the
 * tone already said they were the same fact.
 */

import { BODY_REFUSED } from "@olai/surface"

import { TESTID } from "../testids.ts"

export function BodyRefused(props: {
  /** Extra classes the line's place asks for — truncate on a row, a
   *  margin under a heading. The alarm voice is this element's. */
  readonly class?: string
  /** A span on a row that already has a line; a paragraph everywhere else. */
  readonly as?: "p" | "span"
}) {
  const className = props.class ?? "m-0 italic text-alarm"
  const attrs = {
    class: className,
    "data-testid": TESTID.bodyRefused,
    "data-tone": "alarm" as const,
    role: "alert" as const,
  }
  return props.as === "span" ?
      <span {...attrs}>{BODY_REFUSED}</span>
    : <p {...attrs}>{BODY_REFUSED}</p>
}
