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
 */

import { Show } from "solid-js"

import type { KoluLink } from "@olai/surface"

import { desktop } from "../layout/media.ts"
import { DOT, PILL } from "../readout.ts"
import { TESTID } from "../testids.ts"
import { padiSaid } from "./said.ts"

export function Padi(props: { readonly link: KoluLink }) {
  const said = () => padiSaid(props.link)
  return (
    <Show when={desktop()}>
      <div
        class={`${PILL} max-w-[9.5rem] shrink-0 sm:max-w-none`}
        data-testid={TESTID.padi}
        // The STATUS as an attribute as well as a paint, so a scenario asserts
        // the state rather than a colour — the same contract the terminal dot
        // keeps with `data-face`.
        data-padi={props.link.status}
        title={said().detail}
        aria-label={`kolu: ${said().detail}`}
        aria-live="polite"
      >
        <span class={`${DOT} ${said().dot}`} aria-hidden="true" />
        <span class="min-w-0 truncate">{said().label}</span>
      </div>
    </Show>
  )
}
