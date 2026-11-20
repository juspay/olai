import { sameList } from "@olai/web/client/same.ts"
import { TESTID } from "olai-plugin-layout/testids"
import type { Hung } from "@olai/plugin-api"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Portal } from "solid-js/web"

import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { type Anchor, styleOf } from "@olai/web/client/anchor.ts"
import { connectionReadout } from "@olai/web/client/wire.ts"
import { createPopover } from "@olai/web/client/popover.ts"
import { lookOf } from "@olai/web/client/connection/status.ts"
import { ICON_BUTTON, PANEL_BOX, TONE } from "@olai/web/client/readout.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { LAYER } from "@olai/web/client/layer.ts"

import { hung } from "./faces.ts"
import { nameOf, tipOf, worstFirst, worstOf } from "./health.ts"
import { Indicator } from "./Indicator.tsx"
import type { BarSeat, BarStatus, BarTone } from "./slots.ts"
import { HealthSeat } from "./contracts/BarDoor.tsx"
import { Tools } from "./Tools.tsx"
import { Uptime } from "./Uptime.tsx"

const ROWS_WIDTH = 320

const narrowed = (at: Anchor, edge: number | undefined): Record<string, string | undefined> => {
  const right = Math.min(at.left + at.width, edge ?? Number.POSITIVE_INFINITY)
  const width = Math.min(at.width, ROWS_WIDTH, right)
  return { ...styleOf(at), left: `${right - width}px`, width: `${width}px` }
}

/** The right edge of the box the dot sits in, skipping any ancestor that is
 *  not a box at all: the tip wraps its control in a `display: contents` span,
 *  which measures as all zeros. */
const clusterRight = (control: HTMLElement | undefined): number | undefined => {
  let node = control?.parentElement ?? null
  while (node !== null && getComputedStyle(node).display === "contents") node = node.parentElement
  return node === null ? undefined : node.getBoundingClientRect().right
}

const CONNECTION = "connection"
type Row = typeof CONNECTION | Hung<BarSeat>

export function Health(props: { readonly slots: RendererSlots }) {
  const seats = createMemo(() => hung("app.header").filter((one) => one.face.place === "cluster"), undefined, { equals: sameList })
  const statuses = createMemo((): ReadonlyArray<BarStatus> => [
    lookOf(connectionReadout()),
    ...seats().flatMap((one) => one.face.status === undefined ? [] : [one.face.status()]),
  ])
  const toneOf = (row: Row): BarTone =>
    row === CONNECTION ? lookOf(connectionReadout()).tone : row.face.status?.().tone ?? "quiet"
  const rows = createMemo(() => worstFirst<Row>([CONNECTION, ...seats()], toneOf))
  const tone = () => worstOf(statuses())
  let dot: HTMLButtonElement | undefined
  const popover = createPopover()
  const [foot, setFoot] = createSignal<HTMLElement>()

  return (
    <>
      <Tip text={tipOf(statuses())} layer={LAYER.over}>
        <button
          type="button"
          ref={(el) => {
            dot = el
            popover.setTrigger(el)
          }}
          class={`${ICON_BUTTON} !px-0 md:!w-7`}
          data-testid={TESTID.health}
          data-health={tone()}
          data-connection={connectionReadout().status}
          aria-label={nameOf(statuses())}
          aria-expanded={popover.open()}
          aria-haspopup="true"
          onClick={() => popover.toggle()}
        >
          <span
            class={`inline-block size-2.5 rounded-full ${TONE[tone()].dot}`}
            role="img"
            aria-label={tipOf(statuses())}
          />
        </button>
      </Tip>
      <Show when={popover.open() ? popover.at() : null}>
        {(at) => (
          <Portal>
            <section
              ref={popover.setPanel}
              class={`${PANEL_BOX} gap-0.5 !p-2`}
              style={narrowed(at(), clusterRight(dot))}
              tabindex="-1"
              data-testid={TESTID.healthPanel}
              aria-label="status"
            >
              <For each={rows()}>
                {(row) => row === CONNECTION
                  ? <Indicator readout={connectionReadout()} />
                  : <row.face.body />}
              </For>
              <Uptime />
              <div ref={setFoot} class="mt-1 border-t border-rule pt-1" />
            </section>
          </Portal>
        )}
      </Show>
      <HealthSeat.Provider value={{
        dot: () => dot,
        foot: () => (popover.open() ? foot() : undefined),
        shut: popover.close,
      }}>
        <Tools slots={props.slots} where="health" />
      </HealthSeat.Provider>
    </>
  )
}
