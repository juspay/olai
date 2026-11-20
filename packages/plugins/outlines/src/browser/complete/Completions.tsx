import { PAGE_SUBJECT } from "olai-plugin-navigation/contract"
import { useHere } from "olai-plugin-navigation/routing"
import { servedDirectory } from "../vault.ts"
import { crumbAsides } from "../faces.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { Popper } from "@kobalte/core/popper"
import { createSignal, Index, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { ALARM_BAND, SaidLine } from "@olai/web/client/SaidLine.tsx"
import { LAYER } from "@olai/web/client/layer.ts"
import { overlayRoot } from "../overlay.ts"
import { Result, type RowTestids } from "olai-plugin-search/ui/Result.tsx"

const COMPLETION_ROW: RowTestids = {
  row: TESTID.completionItem,
  place: TESTID.completionItemPlace,
  prop: TESTID.completionItemProp,
}

import type { Listing } from "./completing.tsx"

export function Completions(props: { readonly listing: Listing }) {
  const here = useHere()
  const [host, setHost] = createSignal<HTMLElement>()
  const [content, setContent] = createSignal<HTMLElement>()

  const rectOf = (): DOMRect | undefined => {
    const el = host()
    if (el === undefined) return undefined
    const cell = el.parentElement
    if (cell === null) {
      throw new Error("completions: the title cell is gone — the list cannot hang")
    }
    return cell.getBoundingClientRect()
  }

  return (
    <span ref={setHost} class="contents">
    <Show when={props.listing.showing()}>
      <Popper
        anchorRef={host}
        contentRef={content}
        getAnchorRect={rectOf}
        placement="bottom-start"
        gutter={4}
      >
      <Portal mount={overlayRoot()}>
      <Popper.Positioner>
      <div
        {...{ [PAGE_SUBJECT]: String(here()) }}
        ref={setContent}
        class={`relative ${LAYER.row} w-[min(24rem,80vw)] overflow-hidden rounded-surface border border-rule/60 bg-panel shadow-raised`}
        data-testid={TESTID.completions}
        data-kind={props.listing.kind() ?? undefined}
        role="listbox"
        aria-label="Suggestions"
      >
        <Show when={props.listing.failure()}>
          {(failure) => (
            <SaidLine
              said={{ tone: "alarm", text: failure() }}
              class={`${ALARM_BAND} px-3`}
              testid={TESTID.completionsError}
            />
          )}
        </Show>
        <ul class="m-0 max-h-64 list-none overflow-x-hidden overflow-y-auto p-1">
          <Index each={props.listing.choices()}>
            {(choice, index) => (
              <li>
                <Result
        claims={servedDirectory()?.claims()}
                  label={choice().label}
                  hint={choice().hint}
                  place={choice().place}
                  props={choice().props}
                  faces={crumbAsides()}
                  from={choice().from}
                  active={index === props.listing.active()}
                  testids={COMPLETION_ROW}
                  id={choice().id}
                  onHover={() => props.listing.hover(index)}
                  onSelect={() => choice().choose()}
                />
              </li>
            )}
          </Index>
        </ul>
      </div>
      </Popper.Positioner>
      </Portal>
      </Popper>
    </Show>
    </span>
  )
}
