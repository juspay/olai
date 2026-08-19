/**
 * Closer, further, and back to the whole thing.
 *
 * The gestures are enough for a trackpad and nothing else: a reader on a mouse
 * with no wheel, on a phone, or on a keyboard has no way to move the camera at
 * all — and a control that exists only as a gesture is a control that is not
 * announced. So the three that matter are buttons, and they drive the SAME
 * behaviour the wheel does (`./looking.ts`) rather than writing the transform
 * themselves: two writers of one camera would disagree the moment one of them
 * forgot a clamp.
 *
 * FIT IS A RESET, and that is a property of the layout rather than a shortcut:
 * the placement is already fitted to the frame with a margin (`./layout.ts`), so
 * the camera that shows the whole graph is the one that does nothing. It is the
 * state a page opens in, which is why nothing has to be measured on arrival.
 *
 * They wear `../edges/EdgeVerbs.tsx`' quiet-verb look, like every other small
 * verb this app draws beside a page's own lines.
 */

import { For } from "solid-js"

import { QUIET_VERB } from "../edges/EdgeVerbs.tsx"
import { type TestId, TESTID } from "../testids.ts"
import type { Placed } from "./layout.ts"
import type { Looking } from "./looking.ts"

/** The three, as values — what each is called to a reader who cannot see it,
 *  what it says on screen, and what it does. A table rather than three copies
 *  of the same button, for `./look.ts`'s reason one file over: the row's words
 *  and its testid are one fact about one control. */
const MOVES: ReadonlyArray<{
  readonly said: string
  readonly label: string
  readonly testid: TestId
  readonly does: (looking: Looking, toward: Placed | undefined) => void
}> = [
  {
    said: "−",
    label: "further away",
    testid: TESTID.graphFurther,
    does: (looking, toward) => looking.further(toward),
  },
  {
    said: "+",
    label: "closer",
    testid: TESTID.graphCloser,
    does: (looking, toward) => looking.closer(toward),
  },
  {
    said: "Fit",
    label: "fit the whole graph in the frame",
    testid: TESTID.graphFit,
    does: (looking) => looking.fit(),
  },
]

export function Controls(props: {
  readonly looking: Looking
  /** Where "closer" moves TOWARD — the node the page is about, where it has
   *  one. Without it a zoom is about the middle of the frame, which walks the
   *  subject of a focused reading off the edge. */
  readonly toward: () => Placed | undefined
}) {
  return (
    <div
      class="flex items-center gap-1"
      role="group"
      aria-label="move the graph's camera"
    >
      <For each={MOVES}>
        {(move) => (
          <button
            type="button"
            class={`${QUIET_VERB} min-w-8 justify-center cursor-pointer border-0 bg-transparent`}
            data-testid={move.testid}
            aria-label={move.label}
            onClick={() => move.does(props.looking, props.toward())}
          >
            {move.said}
          </button>
        )}
      </For>
    </div>
  )
}
