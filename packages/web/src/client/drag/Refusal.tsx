/**
 * The face a pane wears when the row over it cannot land there.
 *
 * The other half of `./DropLine.tsx`, and it exists for the same reason that
 * one does: the gesture's answer belongs on screen while the pointer is still
 * down, which is the only moment it is a prediction rather than a file. A drag
 * that only found out at the release would be a person told no after doing the
 * work — and, worse, told nothing at all in the one case where the write is
 * legal somewhere they were not pointing (`./aim.ts` has that argument).
 *
 * IT COVERS THE WHOLE PANE rather than marking a gap, because that is the shape
 * of what it is saying. A drop line is about a PLACE among rows; this is about
 * the PAGE — every row in it is the same no, so a line drawn at one of them
 * would be an answer aimed at the wrong question.
 *
 * THE SENTENCE ITSELF IS `../Refused.tsx`, which is the component that exists
 * so a refusal is not a `<p>` copied per surface — that consolidation was made
 * over four copies that had already drifted in padding, and a fifth here would
 * be the same drift starting again. What this adds around it is the WASH, which
 * is the part that is about a pane rather than about a sentence.
 *
 * WHAT IT SAYS IS WHAT THE BAR WILL SAY. One spelling, carried on the aim, so
 * the reason cannot change between the hand hovering and the hand letting go
 * (`./dragging.ts` sends these same words to the selection's line).
 *
 * Positioned ABSOLUTELY out of a portal in document coordinates, exactly as the
 * line is: with no positioned ancestor an absolute box lies against the initial
 * containing block, so it sits over the pane it names and outside every
 * column's own overflow — a face clipped by the column it is about would be no
 * face at all.
 */

import { Portal } from "solid-js/web"

import { Refused } from "../Refused.tsx"
import { LAYER } from "../layer.ts"
import { TESTID } from "../testids.ts"
import type { Refusal } from "./aim.ts"

export function DropRefusal(props: { readonly refusal: Refusal }) {
  return (
    <Portal>
      <div
        // `LAYER.row` — over the rows it is about and under every piece of
        // chrome, which is the drop line's claim and the same one for the same
        // reason (`../layer.ts`).
        class={`pointer-events-none absolute ${LAYER.row} flex items-center justify-center rounded border-2 border-alarm bg-alarm/10 px-4`}
        style={{
          top: `${props.refusal.top}px`,
          left: `${props.refusal.left}px`,
          width: `${props.refusal.width}px`,
          height: `${props.refusal.height}px`,
        }}
        data-testid={TESTID.dropRefused}
        // Which file said no, so a scenario names it rather than reading prose.
        data-file={props.refusal.file}
      >
        {/* The wash and the sentence are two boxes because they are two
            widths: the no is about the whole pane, and a paragraph as wide as
            a pane is a paragraph nobody reads. */}
        <div class="max-w-sm">
          <Refused said={props.refusal.why} testid={TESTID.dropRefusedSaid} />
        </div>
      </div>
    </Portal>
  )
}
