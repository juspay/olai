/**
 * Everything the page says about its connection, in one place.
 *
 * Two pieces of chrome and one rule connecting them: the dot is always drawn,
 * and the reload surface is drawn on top of it exactly when the state is one a
 * reload is the only way out of (`needsReload`). Keeping the rule here rather
 * than in the app is what lets the app hold ONE element for this whole concern.
 *
 * Both read the SAME transport status, so the dot and the screen cannot
 * disagree about what happened — which is why the seam's required `retired`
 * handler (wire.ts) records rather than renders.
 *
 * The reload itself is `reloadForUpdate` — the framework's, not a hand-rolled
 * `location.reload()`, so the browser lands on the `no-store` shell and the
 * bundle it names rather than on whatever a cache still remembers.
 */

import { reloadForUpdate } from "@kolu/surface-app/lifecycle"
import { Show } from "solid-js"

import { Indicator } from "./Indicator.tsx"
import { Restarted } from "./Restarted.tsx"
import { needsReload, type SurfaceConnectionStatus } from "./status.ts"

export function Connection(props: { readonly status: SurfaceConnectionStatus }) {
  return (
    <>
      <Indicator status={props.status} />
      <Show when={needsReload(props.status)}>
        <Restarted onReload={reloadForUpdate} />
      </Show>
    </>
  )
}
