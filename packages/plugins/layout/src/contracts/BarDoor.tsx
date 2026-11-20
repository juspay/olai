import { createContext, type JSX, Show, useContext } from "solid-js"
import { Portal } from "solid-js/web"

import { LAYER } from "@olai/web/client/layer.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

import type { Anchor } from "@olai/web/client/anchor.ts"
import type { ToolWhere } from "olai-plugin-layout/contract"
import { ENTRY_SHAPE, ROW_GAP } from "olai-plugin-layout/entry"
import { createPopover, type HeldOpen } from "@olai/web/client/popover.ts"
import { ICON_BUTTON, STATUS_ROW } from "@olai/web/client/readout.ts"

export const HealthSeat = createContext<{
  readonly dot: () => HTMLElement | undefined
  readonly foot: () => HTMLElement | undefined
  readonly shut: () => void
}>()

export function BarDoor(props: {
  readonly where?: ToolWhere
  readonly glyph: string
  readonly name: string
  readonly testid: string
  readonly panel: (at: () => Anchor, inside: (el: HTMLElement | undefined) => void) => JSX.Element
  readonly held?: HeldOpen
}) {
  const popover = createPopover(props.held === undefined ? {} : { held: props.held })
  const open = popover.open
  const closet = () => props.where === "closet"
  const health = () => props.where === "health"
  const seat = health() ? useContext(HealthSeat) : undefined
  if (seat !== undefined) popover.setTrigger(seat.dot())

  const trigger = (
    <Tip text={props.name} layer={LAYER.over}>
      <button
        type="button"
        ref={(el) => {
          if (seat === undefined) popover.setTrigger(el)
        }}
        class={
          closet()
            ? `${ENTRY_SHAPE} ${ROW_GAP} w-full`
            : health()
            ? `${STATUS_ROW} ${open() ? "bg-pill/60" : ""}`
            : `${ICON_BUTTON} !px-0 md:!w-7`
        }
        data-testid={props.testid}
        aria-expanded={open()}
        aria-haspopup="true"
        onClick={() => {
          seat?.shut()
          popover.toggle()
        }}
      >
        <span aria-hidden="true" class={health() ? "inline-block w-2 text-center text-muted" : undefined}>{props.glyph}</span>
        <span class={closet() || health() ? undefined : "sr-only"}>
          {props.name}
        </span>
      </button>
    </Tip>
  )

  return (
    <>
      {seat === undefined
        ? trigger
        : <Show when={seat.foot()} keyed>{(foot) => <Portal mount={foot}>{trigger}</Portal>}</Show>}
      <Show when={open() && popover.at() !== null}>
        <Portal>{props.panel(() => popover.at()!, popover.setPanel)}</Portal>
      </Show>
    </>
  )
}
