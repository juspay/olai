import type { JSX } from "solid-js"

export interface PillLook {
  readonly PILL: string
  readonly DOT: string
}

export interface AppPopover {
  readonly open: () => boolean
  readonly toggle: () => void
  readonly close: () => void
  readonly setTrigger: (el: HTMLElement | undefined) => void
  readonly Panel: (props: {
    readonly testid: string
    readonly label: string
    readonly children: JSX.Element
  }) => JSX.Element
}

export interface KoluApp {
  readonly desktop: () => boolean
  readonly pill: PillLook
  readonly popover: () => AppPopover
}
