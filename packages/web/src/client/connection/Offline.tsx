import { TESTID } from "@olai/web/client/testids.ts"
import { reloadForUpdate } from "@kolu/surface-app/lifecycle"
import { createEffect, createMemo, createSignal, onCleanup, Show, type Accessor } from "solid-js"

import { handBackFocus, withOfflineFocus, type FocusMemory } from "./focus.ts"
import { reachable } from "./reaching.ts"
import { frozenLookOf, isFrozen, type SurfaceReadout } from "./status.ts"
import { Reload } from "../Reload.tsx"


export function Offline(props: {
  readonly readout: SurfaceReadout
  readonly memory: FocusMemory
  readonly rosterChanging: Accessor<boolean>
}) {
  let overlay!: HTMLDialogElement
  const [urged, setUrged] = createSignal(false)
  createEffect(() => {
    if (reachable(props.readout)) setUrged(false)
    else if (props.rosterChanging()) setUrged(true)
  })
  const frozen = createMemo(() => isFrozen(props.readout, urged()))
  let handing: (() => void) | undefined
  const stopHanding = () => { handing?.(); handing = undefined }
  onCleanup(stopHanding)
  const look = () => frozenLookOf(props.readout)

  createEffect(() => {
    if (frozen()) {
      stopHanding()
      if (!overlay.open) withOfflineFocus(() => overlay.showModal())
      return
    }
    if (overlay.open) {
      overlay.close()
      stopHanding()
      handing = handBackFocus(props.memory)
    }
  })

  createEffect(() => {
    if (!frozen()) return
    const swallow = (event: KeyboardEvent) => event.stopPropagation()
    window.addEventListener("keydown", swallow, true)
    onCleanup(() => window.removeEventListener("keydown", swallow, true))
  })

  return (
    <dialog
      ref={overlay}
      class="m-auto max-w-sm rounded-surface border border-rule bg-panel px-6 py-5 text-ink shadow-overlay focus:outline-none backdrop:bg-black/60"
      data-testid={TESTID.offline}
      data-connection={props.readout.status}
      onCancel={(event) => event.preventDefault()}
    >
      <h2 class="m-0 mb-1 text-title font-bold">{look().title}</h2>
      <Show when={look().line}>
        {(line) => <p class="m-0 text-body text-muted">{line()}</p>}
      </Show>
      <Show when={props.readout.needsReload}>
        <div class="mt-4">
          <Reload onReload={reloadForUpdate} />
        </div>
      </Show>
    </dialog>
  )
}
