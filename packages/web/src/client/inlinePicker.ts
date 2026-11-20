import { type Accessor, createSignal, onCleanup } from "solid-js"

import { dismissOn } from "./dismiss.ts"

export type PickerState<T> =
  | { readonly _tag: "shut" }
  | { readonly _tag: "open"; readonly over: T }

export interface PickerSeat<T> {
  readonly read: () => PickerState<T>
  readonly write: (state: PickerState<T>) => void
}

export interface InlinePicker<T> {
  readonly open: Accessor<boolean>
  readonly showing: Accessor<T | undefined>
  readonly show: (over: T) => void
  readonly shut: () => void
  readonly focusTrigger: () => void
  readonly toggle: () => void
  readonly list: Accessor<HTMLElement | undefined>
  readonly setTrigger: (el: HTMLElement | undefined) => void
  readonly setList: (el: HTMLElement | undefined) => void
}

export interface Opening<T> {
  readonly opening: () => T
}

export const createInlinePicker = <T>(on: Opening<T>, seat?: PickerSeat<T>): InlinePicker<T> => {
  const [own, setOwn] = createSignal<PickerState<T>>({ _tag: "shut" })
  const up = seat?.read ?? own
  const setUp = seat?.write ?? setOwn

  const open = (): boolean => up()._tag !== "shut"

  const showing = (): T | undefined => {
    const state = up()
    return state._tag === "open" ? state.over : undefined
  }

  const show = (over: T): void => {
    setUp({ _tag: "open", over })
  }

  const shut = (): void => {
    setUp({ _tag: "shut" })
  }

  let trigger: HTMLElement | undefined
  const [list, setBox] = createSignal<HTMLElement | undefined>(undefined)

  dismissOn({ open, root: () => list(), trigger: () => trigger, dismiss: shut })

  return {
    open,
    showing,
    show,
    shut,
    focusTrigger: () => trigger?.focus(),
    list,
    toggle: () => {
      if (!open()) return show(on.opening())
      shut()
      trigger?.focus()
    },
    setTrigger: (el) => {
      trigger = el
    },
    setList: (el) => {
      setBox(el)
      onCleanup(() => {
        setBox(undefined)
      })
    },
  }
}
