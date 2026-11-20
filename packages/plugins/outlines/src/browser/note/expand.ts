import { createAfterGesture } from "@olai/web/client/after-gesture.ts"
import { useShown } from "olai-plugin-navigation/routing"

import { type Accessor, createEffect, createSignal, untrack } from "solid-js"

import { dismissOn } from "@olai/web/client/dismiss.ts"

export interface NoteExpand {
  readonly expanded: Accessor<boolean>
  readonly toggle: () => void
  readonly setRoot: (el: HTMLElement | undefined) => void
  readonly setTrigger: (el: HTMLElement | undefined) => void
}

export const createNoteExpand = (
  fallback: () => boolean,
): NoteExpand => {
  const shown = useShown()
  const [touched, setTouched] = createSignal<boolean | undefined>(undefined)
  const expanded = (): boolean => touched() ?? fallback()
  let root: HTMLElement | undefined
  let trigger: HTMLElement | undefined

  createEffect(() => {
    if (touched() !== true) return
    const afterGesture = createAfterGesture()
    untrack(() => dismissOn({
    open: () => shown() && touched() === true,
    root: () => root,
    trigger: () => trigger,
    dismiss: () => afterGesture(() => { if (shown()) setTouched(false) }),
  }))
  })

  return {
    expanded,
    toggle: () => setTouched(!expanded()),
    setRoot: (el) => {
      root = el
    },
    setTrigger: (el) => {
      trigger = el
    },
  }
}
