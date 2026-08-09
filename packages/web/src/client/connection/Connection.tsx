/**
 * Everything the page says about its connection, in one place.
 *
 * Two pieces of chrome and one rule connecting them: the dot is always drawn,
 * and the reload surface is drawn on top of it exactly when the state is one a
 * reload is the only way out of (`needsReload`). Keeping the rule here rather
 * than in the app is what lets the app hold ONE element for this whole concern.
 *
 * The reload itself is `reloadForUpdate` — the framework's, not a hand-rolled
 * `location.reload()`, so the browser lands on the `no-store` shell and the
 * bundle it names rather than on whatever a cache still remembers.
 */

import type { ServerLifecycleEvent } from "@kolu/surface-app/solid"
import { reloadForUpdate } from "@kolu/surface-app/lifecycle"
import { Show } from "solid-js"

import { connectionOf, needsReload } from "./status.ts"
import { Indicator } from "./Indicator.tsx"
import { Restarted } from "./Restarted.tsx"

export function Connection(props: { readonly event: ServerLifecycleEvent }) {
  const connection = () => connectionOf(props.event)
  return (
    <>
      <Indicator connection={connection()} />
      <Show when={needsReload(connection())}>
        <Restarted onReload={reloadForUpdate} />
      </Show>
    </>
  )
}
