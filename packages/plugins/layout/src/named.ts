import type { App } from "@olai/surface"
import { appName } from "@olai/surface"
import { Result } from "effect"
import { type Accessor, createEffect, createRoot, createSignal, onCleanup } from "solid-js"

import { reachable } from "@olai/web/client/connection/reaching.ts"
import type { SurfaceReadout } from "@olai/web/client/connection/status.ts"

let current: NameState | undefined

export const shouldAsk = (
  readout: SurfaceReadout,
  called: string | undefined,
  inFlight: boolean,
): boolean =>
  reachable(readout) && called === undefined && !inFlight

export const landingOf = (
  app: App,
): { readonly called: string; readonly startedAt: string } => ({
  called: appName(app.hostname),
  startedAt: app.startedAt,
})

export const calledApp: Accessor<string | undefined> = () => current?.called()

export const startedAt: Accessor<string | undefined> = () => current?.started()

export interface FollowName {
  readonly readout: Accessor<SurfaceReadout>
  readonly ask: () => Promise<Result.Result<App, unknown>>
  readonly named?: (called: string) => void
}

export interface NameState {
  readonly called: Accessor<string | undefined>
  readonly started: Accessor<string | undefined>
  readonly dispose: () => void
}

export const createName = (opts: FollowName): NameState => {
  const [called, setCalled] = createSignal<string | undefined>()
  const [started, setStarted] = createSignal<string | undefined>()
  let active = true
  const [tick, pulse] = createSignal(0)
  let inFlight = false
  return createRoot((dispose) => {
    onCleanup(() => { active = false })
    // Once `called` has arrived, a later open (a reconnect to the SAME
    // process, or a retired handshake after a restart) must not re-ask.
    createEffect(() => {
      tick()
      if (!shouldAsk(opts.readout(), called(), inFlight)) return
      inFlight = true
      void opts.ask().then((outcome) => {
        if (!active) return
        inFlight = false
        if (!Result.isSuccess(outcome)) return pulse((n) => n + 1)
        const landed = landingOf(outcome.success)
        setCalled(landed.called)
        opts.named?.(landed.called)
        setStarted(landed.startedAt)
      })
    })
    return { called, started, dispose }
  })
}

export const followName = (opts: FollowName): (() => void) => {
  if (current) throw new Error("A deployment name provider is already active")
  const state = createName(opts)
  current = state
  return () => {
    if (current === state) current = undefined
    state.dispose()
  }
}
