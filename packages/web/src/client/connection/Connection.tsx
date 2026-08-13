/**
 * Everything the page says about its connection, in one place.
 *
 * One rule: the reload surface is drawn exactly when the state is one a reload
 * is the only way out of — and that bit rides the readout (`needsReload`,
 * kolu#2160) rather than being re-derived from a list of state names kept here
 * by hand. A hand-kept list is what once read a terminal state as a transient
 * one and drew "reconnecting…" over a page that never would.
 *
 * The DOT is the other half and it is not drawn here, because where it goes is
 * a layout question — the app header (`../AppHeader.tsx`) is the one home now,
 * on every shape of the app — and this file has no opinion on placement. Both
 * read the SAME readout, so the dot and the screen cannot disagree about what
 * happened; that is a property of the readout, not of them sharing a parent.
 *
 * The reload itself is `reloadForUpdate` — the framework's, not a hand-rolled
 * `location.reload()`, so the browser lands on the `no-store` shell and the
 * bundle it names rather than on whatever a cache still remembers.
 */

import { reloadForUpdate } from "@kolu/surface-app/lifecycle"
import { Show } from "solid-js"

import { Restarted } from "./Restarted.tsx"
import type { SurfaceReadout } from "./status.ts"

export function Connection(props: { readonly readout: SurfaceReadout }) {
  return (
    <Show when={props.readout.needsReload}>
      <Restarted onReload={reloadForUpdate} />
    </Show>
  )
}
