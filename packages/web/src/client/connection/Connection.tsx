/**
 * Everything the page says about its connection, in one place.
 *
 * One rule: the reload surface is drawn exactly when the state is one a reload
 * is the only way out of (`needsReload`). Keeping it here rather than in the
 * app is what stops "when do we say the page is stuck" from being a condition
 * spelled out at a call site.
 *
 * The DOT is the other half and it is not drawn here, because where it goes is
 * a layout question with two answers — the sidebar's footer, or a corner on the
 * screens that have no sidebar — and this file has no opinion on either. Both
 * read the SAME transport status, so the dot and the screen cannot disagree
 * about what happened; that is a property of the status, not of them sharing a
 * parent.
 *
 * The reload itself is `reloadForUpdate` — the framework's, not a hand-rolled
 * `location.reload()`, so the browser lands on the `no-store` shell and the
 * bundle it names rather than on whatever a cache still remembers.
 */

import { reloadForUpdate } from "@kolu/surface-app/lifecycle"
import { Show } from "solid-js"

import { Restarted } from "./Restarted.tsx"
import { needsReload, type SurfaceConnectionStatus } from "./status.ts"

export function Connection(props: { readonly status: SurfaceConnectionStatus }) {
  return (
    <Show when={needsReload(props.status)}>
      <Restarted onReload={reloadForUpdate} />
    </Show>
  )
}
