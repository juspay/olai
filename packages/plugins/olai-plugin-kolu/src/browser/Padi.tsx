/**
 * THE PADI READOUT — whether this olai can see kolu's terminals.
 *
 * The third standing promise in the app's chrome row, beside the connection pill
 * ("is this page still reading?") and the Commit pill ("is what is written to it
 * kept?"). `../ui/padi/said.ts` is where the words come from, and it
 * argues why the per-chip dots are not enough on their own — a hollow beside one
 * terminal cannot tell "this one is gone" from "there is no fleet", and a page
 * with no `terminal` property says nothing at all.
 *
 * It wears the app's pill, which is the same object those two wear — one
 * geometry for the bar, because the header is a fixed height and a wrap inside
 * it pushes the first row off a phone. That geometry is HANDED ACROSS
 * (`./app.ts`) rather than spelled here: this face lives in another package now,
 * and a chip that carried its own copy of the bar's classes would be free to
 * drift the day the bar changed, with the app's own suite green.
 *
 * DESKTOP ONLY, like the pills it sits with, and by the app's own breakpoint: on
 * a phone the chrome row is the wordmark, the burger and search, and everything
 * else is news under the bar or a row in the drawer. A padi that is absent is
 * not news of that kind — nothing is broken, and the terminal rows say so where
 * they are.
 *
 * ## It reads its own half, and is handed no data at all
 *
 * It used to take `link`, `pulse` and `now` as props, filled by the app from a
 * context the app had mounted. That was the app holding three of this
 * appliance's facts to draw one chip. Now the mount (`./mount.tsx`) puts the
 * fleet context up once per tab and this reads it, so what crosses the wall is
 * the app's CONTRACT and never the plugin's DATA — which is the same division
 * the property drawer keeps with its faces one seam over.
 *
 * ## Press it
 *
 * It is a DOOR as well as a readout: pressing it opens the events feed, what
 * recently wanted attention (`./Feed.tsx`). The panel is the app's — one focus
 * cycle for the bar rather than four, and one layer table — so what this file
 * owns is the trigger and what goes inside.
 *
 * What the live announce SEEDS: `aria-live` was on the readout's pill, and this
 * file's own edit DROPS it deliberately — an interactive element double-roars
 * every twin announce keypress, and a door that says two lines (its press AND
 * its changed status) is worse than a door saying none. Status still reads in
 * its `data-padi` attribute, asserted where a scenario needs it.
 */

import { Show } from "solid-js"

import { padiSaid, useFleet } from "../ui/index.ts"

import { TESTID } from "../testids.ts"
import type { KoluApp } from "./app.ts"
import { Feed } from "./Feed.tsx"

export function Padi(props: { readonly app: KoluApp }) {
  // The SAME cell the terminal rows read, through the same context — a second
  // reader rather than a second subscription. Outside the mount (the error
  // report, the waiting page) `useFleet` stands a hollow, which draws as the
  // unwatched face and is the truth for a page with no wire under it.
  const fleet = useFleet()
  const said = () => padiSaid(fleet.link(), fleet.pulse(), fleet.now())
  const quiet = () => said().beat?.kind === "quiet"
  const popover = props.app.createPopover()
  const pill = props.app.pill
  return (
    <Show when={props.app.desktop()}>
      <button
        type="button"
        ref={popover.setTrigger}
        class={`${pill.PILL} max-w-[9.5rem] shrink-0 cursor-pointer sm:max-w-none ${
          quiet() ? pill.PILL_WARN_COAT : ""
        }`}
        data-testid={TESTID.padi}
        // The STATUS as an attribute as well as a paint, so a scenario asserts
        // the state rather than a colour — the same contract the terminal dot
        // keeps with `data-face`. `data-padibeat` is the REGISTER, a second
        // axis: the link can be `connected` while the beat is quiet, which is
        // exactly the state this register was named to paint.
        data-padi={fleet.link().status}
        data-padibeat={said().beat?.kind ?? "none"}
        title={said().detail}
        aria-label={`kolu: ${said().detail}`}
        aria-expanded={popover.open()}
        aria-haspopup="true"
        onClick={() => popover.toggle()}
      >
        <span
          class={`${pill.DOT} ${quiet() ? pill.DOT_HOLLOW_WARN : said().dot}`}
          aria-hidden="true"
        />
        <span class="min-w-0 truncate">{said().label}</span>
        <Show when={quiet() ? said().beat?.said : null}>
          {(beat) => <span class={`shrink-0 ${pill.TEXT_WARN}`}>· {beat()}</span>}
        </Show>
      </button>
      {/* The panel is the app's box — portalled, placed and layered by it —
          and drawn only while open, which is why there is no `Show` here. The
          wrench inside it navigates OUT of the drawer, so it closes without
          the dismissal's walk back to the trigger: the page it lands on is
          where the reader's caret goes. */}
      <popover.Panel
        testid={TESTID.padiFeed}
        label="what recently wanted attention"
      >
        <Feed app={props.app} onLeave={popover.close} />
      </popover.Panel>
    </Show>
  )
}
