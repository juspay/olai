import { TESTID } from "@olai/edit-history/testids.ts"
import { Show } from "solid-js"

import { LAYER } from "@olai/web/client/layer.ts"

import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import type { Said } from "@olai/web/client/saying.ts"

export function UndoSaid(props: { readonly said: Said | null }) {
  return (
    <Show when={props.said}>
      {(said) => (
        <div
          class={`pointer-events-none fixed inset-x-0 top-[var(--height-header)] ${LAYER.chrome} flex justify-center px-4`}
        >
          <SaidLine
            said={said()}
            class={`mt-2 max-w-lg rounded-surface border bg-paper px-3 py-1.5 text-body leading-snug shadow-raised ${
              said().tone === "alarm" ? "border-alarm" : "border-rule"
            }`}
            testid={TESTID.undoSaid}
          />
        </div>
      )}
    </Show>
  )
}
