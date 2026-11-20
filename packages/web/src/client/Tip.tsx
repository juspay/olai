import { TESTID } from "@olai/ui-primitives/testids.ts"
import { createContext, useContext, createEffect, createSignal, type JSX, onCleanup, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { LAYER } from "./layer.ts"

import { clampedLeft, clampedTop, createTips, liftedTop } from "./tip.ts"

interface At {
  readonly left: number
  readonly top: number
  readonly floor: number
}

const Tips = createContext<ReturnType<typeof createTips>>()
export function TipScope(props: { readonly children: JSX.Element }) {
  return <Tips.Provider value={createTips()}>{props.children}</Tips.Provider>
}

export const TipFloor = createContext<() => number>(() => 0)

export function Tip(props: {
  readonly text: string
  readonly disabled?: boolean
  readonly say?: boolean
  readonly children: JSX.Element
  readonly layer?: typeof LAYER.page | typeof LAYER.over
}) {
  const tips = useContext(Tips)
  if (tips === undefined) throw new Error("a tooltip outside <TipScope>")
  const { takeTip, showTip, hideTip, tipShowing } = tips
  const tipFloor = useContext(TipFloor)
  let anchor: HTMLSpanElement | undefined

  const Enabled = () => {
    const me = takeTip()
    const [at, setAt] = createSignal<At>()
    onCleanup(() => hideTip(me))

    const show = (): void => {
      const box = anchor?.firstElementChild?.getBoundingClientRect()
      if (box === undefined) return
      const floor = tipFloor()
      setAt({ left: box.left, top: clampedTop(box.bottom, floor), floor })
      showTip(me)
    }

    const hide = (): void => {
      hideTip(me)
    }

    const place = (tip: HTMLDivElement): void => {
      const want = at()
      if (want === undefined) return
      tip.style.left = "0px"
      const box = tip.getBoundingClientRect()
      const left = clampedLeft(want.left, box.width, window.innerWidth)
      const top = liftedTop(want.top, box.height, window.innerHeight, want.floor)
      tip.style.left = `${left}px`
      tip.style.top = `${top}px`
    }

    const Drawn = (drawn: { readonly at: At }) => {
      let tip: HTMLDivElement | undefined
      // `onMount`, not the `ref` callback: a ref fires while the element is
      // still detached, where its rectangle is all zeros.
      onMount(() => {
        if (tip !== undefined) place(tip)
        window.addEventListener("scroll", hide, { capture: true, passive: true })
        onCleanup(() => window.removeEventListener("scroll", hide, true))
      })
      createEffect(() => {
        props.text
        if (tip !== undefined) place(tip)
      })

      return (
        <div
          ref={tip}
          class={`pointer-events-none fixed ${props.layer ?? LAYER.page} max-w-[min(24rem,calc(100vw-1rem))] rounded-control border border-rule/60 bg-panel px-2 py-1 text-label whitespace-pre-line text-ink shadow-raised`}
          style={{ left: `${drawn.at.left}px`, top: `${drawn.at.top}px` }}
          data-testid={TESTID.tip}
          role="presentation"
        >
          {props.text}
        </div>
      )
    }

    onMount(() => {
      const element = anchor
      if (!element) return
      const keydown = (event: KeyboardEvent) => {
        if (event.key === "Escape") hide()
      }
      element.addEventListener("mouseenter", show)
      element.addEventListener("mouseleave", hide)
      element.addEventListener("focusin", show)
      element.addEventListener("focusout", hide)
      element.addEventListener("keydown", keydown)
      onCleanup(() => {
        element.removeEventListener("mouseenter", show)
        element.removeEventListener("mouseleave", hide)
        element.removeEventListener("focusin", show)
        element.removeEventListener("focusout", hide)
        element.removeEventListener("keydown", keydown)
      })
    })

    return (
      <Show when={tipShowing(me) ? at() : undefined}>
        {(spot) => (
          <Portal mount={document.body}>
            <Drawn at={spot()} />
          </Portal>
        )}
      </Show>
    )
  }

  return (
    <span ref={anchor} class="contents">
      {props.children}
      <Show when={props.say === true}><span class="sr-only">{props.text}</span></Show>
      <Show when={!props.disabled}><Enabled /></Show>
    </span>
  )
}
