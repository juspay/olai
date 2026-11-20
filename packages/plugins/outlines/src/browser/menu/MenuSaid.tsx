import { TESTID } from "olai-plugin-outlines/testids"
import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import type { Said } from "@olai/web/client/saying.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { overlayRoot } from "../overlay.ts"


interface At {
  readonly left: number
  readonly top: number
}

const sameAt = (a: At | null, b: At | null): boolean =>
  a === b || (a !== null && b !== null && a.left === b.left && a.top === b.top)

export function MenuSaid(props: { readonly said: Said | null }) {
  let host: HTMLSpanElement | undefined
  const [at, setAt] = createSignal<At | null>(null, { equals: sameAt })

  const measure = (): void => {
    if (host === undefined) return
    const cell = host.parentElement
    if (cell === null) {
      throw new Error("MenuSaid: the row gutter is gone — the line cannot hang")
    }
    const box = cell.getBoundingClientRect()
    setAt({ left: box.left, top: box.bottom + 2 })
  }

  createEffect(() => {
    if (props.said === null) {
      setAt(null)
      return
    }
    measure()
    window.addEventListener("resize", measure)
    document.addEventListener("scroll", measure, true)
    onCleanup(() => {
      window.removeEventListener("resize", measure)
      document.removeEventListener("scroll", measure, true)
    })
  })

  return (
    <span ref={host} class="contents">
      <Show when={props.said}>
        {(message) => (
          <Show when={at()}>
            {(spot) => (
              <Portal mount={overlayRoot()}>
                <SaidLine
                  said={message()}
                  class={`fixed ${LAYER.row} m-0 max-w-[24rem] w-max rounded-control border border-rule/60 bg-panel px-2 py-1 text-label shadow-raised`}
                  style={{ left: `${spot().left}px`, top: `${spot().top}px` }}
                  testid={TESTID.nodeMenuSaid}
                />
              </Portal>
            )}
          </Show>
        )}
      </Show>
    </span>
  )
}
