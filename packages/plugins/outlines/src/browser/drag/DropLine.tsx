import { overlayRoot } from "../overlay.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { Portal } from "solid-js/web"

import { LAYER } from "@olai/web/client/layer.ts"

import type { Landing } from "./plan.ts"

export function DropLine(props: { readonly landing: Landing }) {
  return (
    <Portal mount={overlayRoot(document.body)}>
      <div
        class={`pointer-events-none absolute ${LAYER.row} h-0.5 -translate-y-px rounded-full bg-accent`}
        style={{
          top: `${props.landing.top}px`,
          left: `${props.landing.left}px`,
          width: `${props.landing.width}px`,
        }}
        data-testid={TESTID.dropLine}
        data-parent={props.landing.parent ?? ""}
        data-after={props.landing.after ?? ""}
        data-depth={String(props.landing.depth)}
        aria-hidden="true"
      />
    </Portal>
  )
}
