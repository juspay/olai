import { TESTID } from "olai-plugin-navigation/testids"
import { ALARM_PILL,QUIET_PILL } from "@olai/web/client/pill.ts"

import type { Asking } from "./asking.ts"

export function Question(props: {
  readonly asking: Asking
  readonly onGo: () => void
  readonly onCancel: () => void
}) {
  return (
    <div class="px-4 py-3" role="group" aria-label={props.asking.question}>
      <p
        class="m-0 text-label leading-snug text-ink"
        data-testid={TESTID.paletteConfirm}
        role="alert"
        aria-live="assertive"
      >
        {props.asking.question}
      </p>
      <div class="mt-2 flex gap-2">
        <button
          type="button"
          ref={(element) => {
            if (props.asking.kind !== "confirm") return
            queueMicrotask(() => {
              const at = element.ownerDocument.activeElement
              if (at !== null && element.parentElement?.contains(at) === true) return
              element.focus()
            })
          }}
          class={`${props.asking.kind === "confirm" ? ALARM_PILL : QUIET_PILL} cursor-pointer`}
          data-testid={TESTID.paletteItem}
          data-id="go"
          onClick={() => props.onGo()}
        >
          {props.asking.label}
        </button>
        <button
          type="button"
          class={`${QUIET_PILL} cursor-pointer`}
          data-testid={TESTID.paletteItem}
          data-id="cancel"
          onClick={() => props.onCancel()}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
