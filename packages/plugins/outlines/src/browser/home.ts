import { Result } from "effect"
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"
import { runAsync } from "@olai/web/client/run.ts"
import { connectionEpoch, connectionReadout } from "@olai/web/client/wire.ts"
import { reachable } from "@olai/web/client/connection/reaching.ts"
import type { Home } from "../contracts/references.ts"
import { client } from "../client.ts"

/** Where a node lives, read over this row's own wire and owned by the caller.
 *  A call the wire dropped (busy: the connection was replaced) is asked again
 *  when the next connection is established — the wire's clock, not a timer. */
export const nodeHome = (id: string): Accessor<Home> => {
  const [home, setHome] = createSignal<Home>()
  createEffect(() => {
    connectionEpoch()
    if (!reachable(connectionReadout())) return
    let current = true
    onCleanup(() => { current = false })
    void runAsync(client().procedures.nodes.homes({ ids: [id], files: [] })).then(outcome => {
      if (!current) return
      if (Result.isSuccess(outcome)) setHome(outcome.success.homes.find(one => one.id === id)?.file ?? null)
      else if (outcome.failure._tag !== "BusyFailure") setHome(new Error(outcome.failure.reason))
    })
  })
  return home
}
