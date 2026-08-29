/**
 * THE PADI READOUT — whether this olai can see kolu's terminals.
 *
 * The third standing promise in the chrome row, beside the connection pill
 * ("is this page still reading?") and the Commit pill ("is what is written to
 * it kept?"). See `./said.ts` for why the dots are not enough on their own.
 *
 * It wears `../readout.ts`'s pill, which is the same object those two wear —
 * one geometry for the bar, because the header is a fixed height and a wrap
 * inside it pushes the first row off a phone.
 *
 * DESKTOP ONLY, like the pills it sits with: on a phone the chrome row is the
 * wordmark, the burger and search, and everything else is news under the bar
 * or a row in the drawer. A padi that is absent is not news of that kind —
 * nothing is broken, and the terminal chips say so where they are.
 *
 * ## Press it
 *
 * It is a DOOR as well as a readout: pressing it opens the events feed,
 * what recently wanted attention (`./Feed.tsx` — the log the watcher keeps,
 * `@olai/kolu-ui`'s to answer and this file's to hang). The popover is
 * `../popover.ts`'s, as the Commit panel's and the preferences' are: one
 * focus cycle for the bar, rather than four.
 *
 * What the live announce SEEDS: `aria-live` was on the readout's pill, and
 * this file's own edit DROPS it deliberately — an interactive element
 * double-roars every twin announce keypress, and a door that says two
 * lines (its press AND its changed status) is worse than a door saying
 * none. Status still reads in its `data-padi` attribute, asserted where
 * a scenario needs it.
 */

import { Show } from "solid-js"
import { Portal } from "solid-js/web"

import type { KoluLink } from "@olai/surface"

import { desktop } from "../layout/media.ts"
import { DOT, DOT_HOLLOW_WARN, PILL, PILL_WARN_COAT, TEXT_WARN } from "../readout.ts"
import { TESTID } from "../testids.ts"
import { createPopover } from "../popover.ts"
import { Feed } from "./Feed.tsx"
import { padiSaid } from "@olai/kolu-ui"
import type { WatchPulse } from "@olai/surface"
import type { Accessor } from "solid-js"

export function Padi(props: {
  readonly link: KoluLink
  /** The watcher's pulse stamp (`@olai/surface`'s `pulse` cell) — the
   *  `watcher pulse … ago` the pill's inspection face can spell, or the
   *  quiet the register on it is warning about. */
  readonly pulse: WatchPulse | null | undefined
  /** The clock the pill's folds run on — `useFleet`'s now, which ticks
   *  `age → quiet` over without waiting for a beat to tell it so. */
  readonly now: Accessor<number>
}) {
  const said = () => padiSaid(props.link, props.pulse, props.now())
  const quiet = () => said().beat?.kind === "quiet"
  const popover = createPopover()
  return (
    <Show when={desktop()}>
      <button
        type="button"
        ref={popover.setTrigger}
        class={`${PILL} max-w-[9.5rem] shrink-0 cursor-pointer sm:max-w-none ${
          quiet() ? PILL_WARN_COAT : ""
        }`}
        data-testid={TESTID.padi}
        // The STATUS as an attribute as well as a paint, so a scenario asserts
        // the state rather than a colour — the same contract the terminal dot
        // keeps with `data-face`. `data-padibeat` is the REGISTER, a second
        // axis: the link can be `connected` while the beat is quiet, which is
        // exactly the state this register was named to paint.
        data-padi={props.link.status}
        data-padibeat={said().beat?.kind ?? "none"}
        title={said().detail}
        aria-label={`kolu: ${said().detail}`}
        aria-expanded={popover.open()}
        aria-haspopup="true"
        onClick={() => popover.toggle()}
      >
        <span class={`${DOT} ${quiet() ? DOT_HOLLOW_WARN : said().dot}`} aria-hidden="true" />
        <span class="min-w-0 truncate">{said().label}</span>
        <Show when={quiet() ? said().beat?.said : null}>
          {(beat) => <span class={`shrink-0 ${TEXT_WARN}`}>· {beat()}</span>}
        </Show>
      </button>
      <Show when={popover.open() ? popover.at() : null}>
        {(at) => (
          <Portal>
            {/* The wrench's press navigates out of the drawer, so the panel
                closes WITHOUT the dismissal's walk back to the trigger —
                the page it lands on is where the reader's caret goes. */}
            <Feed at={at()} inside={popover.setPanel} onLeave={popover.close} />
          </Portal>
        )}
      </Show>
    </Show>
  )
}
