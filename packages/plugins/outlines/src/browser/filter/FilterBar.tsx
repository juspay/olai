import { TESTID } from "olai-plugin-outlines/testids"
import { createSignal, Show } from "solid-js"

import type { Asked } from "./asking.ts"
import { DoneFlip } from "./DoneFlip.tsx"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { listKey } from "@olai/web/client/keys.ts"
import { Refusals } from "@olai/web/client/refusals.tsx"

import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { createOffer } from "../complete/offer.tsx"
import { countSaid } from "./count.ts"
import { FILTER_FORMS, type FilterForm } from "./forms.ts"
import type { Narrowing } from "./narrowing.ts"

const PLACEHOLDER = "Filter"

export function FilterBar(props: {
  readonly narrowing: Narrowing
  readonly asked: Pick<Asked, "failure">
  readonly doneAt: string | undefined
  readonly onType: (text: string) => void
}) {
  const said = () =>
    countSaid({
      answering: props.narrowing.answering(),
      failure: props.asked.failure(),
      counts: props.narrowing.counts(),
    })

  let input: HTMLInputElement | undefined
  const [focused, setFocused] = createSignal(false)
  const [shut, setShut] = createSignal(false)
  const put = ({ form, select }: FilterForm): void => {
    if (input === undefined) return
    input.value = form
    input.setSelectionRange(select[0], select[1])
    props.onType(form)
  }
  const hint = createOffer({
    showing: () => focused() && !shut() && props.narrowing.text() === "",
    offered: FILTER_FORMS.map((one) => ({ id: one.form, label: one.form, hint: one.hint, choose: () => put(one) })),
    dismiss: () => setShut(true),
  })

  return (
    <div
      class="mb-4"
      data-testid={TESTID.filterBar}
      data-asked={props.narrowing.answering() ?? undefined}
    >
      <div class="flex items-center gap-4">
        <div class="relative flex min-w-0 flex-1 items-center md:w-72 md:flex-none">
          <input
            ref={input}
            type="text"
            role="combobox"
            class="min-h-11 w-full min-w-0 rounded-control border border-rule bg-desk/60 py-1 pl-2.5 pr-11 text-body md:pr-9 text-ink placeholder:text-muted focus:border-accent focus:bg-paper md:min-h-0 md:h-8"
            data-testid={TESTID.filterInput}
            placeholder={PLACEHOLDER}
            aria-label="Filter"
            enterkeyhint="search"
            autocorrect="off"
            autocapitalize="none"
            spellcheck={false}
            aria-autocomplete="list"
            aria-expanded={focused() && !shut() && props.narrowing.text() === ""}
            value={props.narrowing.text()}
            onFocus={() => {
              setShut(false)
              setFocused(true)
            }}
            onBlur={() => setFocused(false)}
            onInput={(event) => props.onType(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (hint.key(event)) {
                event.preventDefault()
                return
              }
              if (listKey(event) !== "dismiss") return
              event.preventDefault()
              props.onType("")
              event.currentTarget.blur()
            }}
          />
          <Show when={props.narrowing.active()}>
            <button
              type="button"
              class={`${TARGET_BOX} absolute inset-y-0 right-0 inline-flex items-center justify-center rounded-control text-muted hover:text-ink md:min-h-0 md:min-w-0 md:w-8`}
              data-testid={TESTID.filterClear}
              aria-label="Clear filter"
              onClick={() => props.onType("")}
            >
              <span aria-hidden="true" class="text-title leading-none">×</span>
            </button>
          </Show>
          <hint.Panel />
        </div>
        <Show when={props.doneAt}>{(file) => <DoneFlip file={file()} />}</Show>
      </div>

      <Show when={props.narrowing.active() && said()}>
        {(line) => (
          <p
            class="m-0 mt-1 text-label text-muted"
            data-testid={TESTID.filterCount}
            aria-live="polite"
          >
            {line()}
          </p>
        )}
      </Show>

      <Refusals
        of={props.narrowing.refusals()}
        class="m-0 mt-1 text-label"
        testid={TESTID.filterRefusal}
      />

      <Show when={props.asked.failure()}>
        {(said) => (
          <SaidLine
            said={{ tone: "alarm", text: said() }}
            class="m-0 mt-1 text-label"
            testid={TESTID.filterFailure}
          />
        )}
      </Show>
    </div>
  )
}
