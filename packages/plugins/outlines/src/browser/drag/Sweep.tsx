import { overlayRoot } from "../overlay.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { Show } from "solid-js"
import { Portal } from "solid-js/web"

import { LAYER } from "@olai/web/client/layer.ts"

import type { Sweep } from "./sweep.ts"

export function SweepBand(props: { readonly sweep: Sweep | null }) {
  return (
    <Show when={props.sweep}>
      {(sweep) => (
        <Portal mount={overlayRoot(document.body)}>
          <div
            class={`pointer-events-none absolute ${LAYER.row} rounded-control border border-accent/40 bg-accent/10`}
            style={{
              top: `${sweep().top}px`,
              left: `${sweep().left}px`,
              width: `${sweep().width}px`,
              height: `${sweep().bottom - sweep().top}px`,
            }}
            data-testid={TESTID.sweepBand}
            data-rows={String(sweep().run?.keys.length ?? 0)}
            aria-hidden="true"
          />
        </Portal>
      )}
    </Show>
  )
}
