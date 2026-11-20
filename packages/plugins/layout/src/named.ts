import type { App } from "@olai/surface"
import { appName } from "@olai/surface"
import { Result } from "effect"
import { type Accessor, createEffect, createRoot, createSignal, onCleanup } from "solid-js"

import { reachable } from "@olai/web/client/connection/reaching.ts"
import type { SurfaceReadout } from "@olai/web/client/connection/status.ts"

let current: NameState | undefined

export interface Landed {
  readonly phase: "landed"
  readonly called: string
  readonly startedAt: string
}

export type Landing = { readonly phase: "waiting" } | { readonly phase: "asking" } | Landed

export const WAITING: Landing = { phase: "waiting" }
export const ASKING: Landing = { phase: "asking" }

export const shouldAsk = (readout: SurfaceReadout, landing: Landing): boolean =>
  reachable(readout) && landing.phase === "waiting"

export const landingOf = (app: App): Landed => ({
  phase: "landed",
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
  const [landing, setLanding] = createSignal<Landing>(WAITING)
  let active = true
  return createRoot((dispose) => {
    onCleanup(() => { active = false })
    const retryAfterFailedAsk = (): void => { setLanding(WAITING) }
    createEffect(() => {
      if (!shouldAsk(opts.readout(), landing())) return
      setLanding(ASKING)
      void opts.ask().then((outcome) => {
        if (!active) return
        if (!Result.isSuccess(outcome)) return retryAfterFailedAsk()
        const landed = landingOf(outcome.success)
        setLanding(landed)
        opts.named?.(landed.called)
      })
    })
    const landed = (): Landed | undefined => {
      const now = landing()
      return now.phase === "landed" ? now : undefined
    }
    return { called: () => landed()?.called, started: () => landed()?.startedAt, dispose }
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
