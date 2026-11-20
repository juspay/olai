import { TESTID } from "olai-plugin-outlines/testids"
import { Show } from "solid-js"

import {
  doneHidden,
  doneHiddenOn,
  doneOverride,
  letDoneFollow,
  setDoneFor,
} from "../settings/done.ts"

import { TARGET, TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

export function DoneFlip(props: { readonly file: string }) {
  const shown = (): boolean => !doneHiddenOn(props.file)
  const own = () => doneOverride(props.file) !== undefined
  const word = (on: boolean): string => (on ? "shown" : "hidden")

  const said = (): string =>
    own()
      ? `Finished items ${word(shown())} here. Your default: ${word(!doneHidden())}.`
      : `Finished items ${word(shown())}, as your default.`

  return (
    <Tip text={said()}>
      <span
        role="group"
        aria-label="Finished items"
        class="inline-flex shrink-0 items-center gap-2"
        data-testid={TESTID.doneFlip}
        data-file={props.file}
        data-own={own() ? "true" : undefined}
        data-shown={shown() ? "true" : "false"}
      >
        <label class={`${TARGET} inline-flex cursor-pointer select-none items-center gap-1.5 text-body text-muted hover:text-ink md:min-h-0`}>
          <input
            type="checkbox"
            class="size-3.5 cursor-pointer accent-ink"
            data-testid={TESTID.doneToggle}
            checked={shown()}
            aria-label="Show finished"
            onChange={(event) => setDoneFor(props.file, event.currentTarget.checked ? "shown" : "hidden")}
          />
          <span aria-hidden="true">Finished</span>
        </label>
        <Show when={own()}>
          <Tip text="Use my default">
            <button
              type="button"
              class={`${TARGET_BOX} inline-flex items-center justify-center text-label text-muted underline decoration-rule underline-offset-2 hover:text-ink md:min-h-0 md:min-w-0`}
              data-testid={TESTID.doneRelease}
              aria-label="Use my default"
              onClick={() => letDoneFollow(props.file)}
            >
              Reset
            </button>
          </Tip>
        </Show>
      </span>
      <span class="sr-only">{said()}</span>
    </Tip>
  )
}
