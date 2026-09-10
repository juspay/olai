/** Deployment naming is a separate lease on appearance. Releasing the source
 * restores the inherited name while retaining the active theme and attention. */
import { Effect } from "effect"
import { createEffect, createRoot, type Accessor } from "solid-js"
import type { Appearance } from "./index.ts"

export const followDeployment = (chrome: Appearance["chrome"], called: Accessor<string | undefined>) =>
  Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    createEffect(() => chrome.name(called()))
    return dispose
  })), dispose => Effect.sync(() => {
    dispose()
    chrome.name(undefined)
  }))
