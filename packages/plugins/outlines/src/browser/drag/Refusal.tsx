import { overlayRoot } from "../overlay.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { Portal } from "solid-js/web"

import { Refused } from "@olai/web/client/Refused.tsx"
import { LAYER } from "@olai/web/client/layer.ts"

import type { Refusal } from "./aim.ts"

export function DropRefusal(props: { readonly refusal: Refusal }) {
  return (
    <Portal mount={overlayRoot(document.body)}>
      <div
        class={`pointer-events-none absolute ${LAYER.row} flex items-center justify-center rounded-control border-2 border-alarm bg-alarm/10 px-4`}
        style={{
          top: `${props.refusal.top}px`,
          left: `${props.refusal.left}px`,
          width: `${props.refusal.width}px`,
          height: `${props.refusal.height}px`,
        }}
        data-testid={TESTID.dropRefused}
        data-file={props.refusal.file}
      >
        <div class="max-w-sm">
          <Refused said={props.refusal.why} testid={TESTID.dropRefusedSaid} />
        </div>
      </div>
    </Portal>
  )
}
