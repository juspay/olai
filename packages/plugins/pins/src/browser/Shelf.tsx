import { TESTID } from "olai-plugin-pins/testids"
import { Key } from "@solid-primitives/keyed"
import type { Undo } from "@olai/edit-history/undoing.ts"
import { createEffect,createMemo,createSelector,createSignal,Show } from "solid-js"

import { createDrags,TRAVEL_PX } from "@olai/web/client/pointer.ts"
import { selector } from "@olai/ui-primitives/testids.ts"
import { applying } from "./writes.ts"
import { REGION,REGION_HEAD,REGION_LABEL } from "olai-plugin-layout/entry"

import { useRouter } from "olai-plugin-navigation/routing"
import { usePins } from "./answered.tsx"
import { askName } from "./naming.ts"
import { Pin } from "./Pin.tsx"
import { sayPin } from "./status.ts"
import { type Pin as Pinned,pinsOf } from "./pins.ts"
import { gapAt,placing } from "./reorder.ts"

interface Measured {
  readonly middles: ReadonlyArray<number>
  readonly gaps: ReadonlyArray<number>
}

interface Carrying {
  readonly order: string
  readonly from: number
  readonly rows: Measured
  readonly gap: number
}

export function Shelf(props: { readonly record: Undo["record"] }) {
  const shelf = usePins()
  const router = useRouter()
  const drags = createDrags()

  const routes = router.routes
  const pins = createMemo(() => pinsOf(routes, shelf()))
  const order = createMemo(() => JSON.stringify(pins().map((pin) => pin.id)))

  const [gesture, setCarrying] = createSignal<Carrying | undefined>(undefined)
  const carrying = createMemo(() => { const held = gesture(); return held?.order === order() ? held : undefined })
  const isLifted = createSelector(() => carrying()?.from)
  let travelled = false
  let list: HTMLUListElement | undefined

  const measure = (): Measured => {
    const top = listTop()
    const at = [...(list?.querySelectorAll(selector(TESTID.pin)) ?? [])]
      .map((row) => row.getBoundingClientRect())
    return {
      middles: at.map((row) => row.top + row.height / 2 - top),
      gaps: [...at.map((row) => row.top - top), (at.at(-1)?.bottom ?? top) - top],
    }
  }

  const listTop = (): number => list?.getBoundingClientRect().top ?? 0

  const grab = (at: number, event: PointerEvent) => {
    if (event.button !== 0) return
    travelled = false
    const was = order()
    drags.start(event, {
      threshold: TRAVEL_PX,
      onStart: () => {
        travelled = true
        setCarrying({ from: at, rows: measure(), gap: at, order: was })
      },
      onMove: (event) =>
        setCarrying((held) =>
          held === undefined
            ? undefined
            : { ...held, gap: gapAt(held.rows.middles, event.clientY - listTop()) }
        ),
      onEnd: (ended) => {
        const held = carrying()
        setCarrying(undefined)
        if (ended === null || held === undefined || held.order !== order()) return
        const edit = placing(pins(), held.from, held.gap)
        if (edit === undefined) return
        void applying(edit, props.record).then(sayPin)
      },
    })
  }

  const unpin = (pin: Pinned) => {
    void applying({ verb: "trash", id: pin.id }, props.record).then(sayPin)
  }

  const currentLayout = createMemo(() => routes.layoutHref(router.workspace()))
  const isHere = createSelector(() => routes.href(router.route()))
  const isCurrent = (pin: Pinned): boolean => pin.target.kind === "page"
    ? isHere(routes.href(pin.target.route))
    : routes.layoutHref(pin.target.workspace) === currentLayout()

  return (
    <Show when={pins().length > 0}>
      <section class={`relative ${REGION}`} data-testid={TESTID.pinShelf}>
        <div class={REGION_HEAD}><h2 class={REGION_LABEL}>Pinned</h2></div>
        <ul class="m-0 list-none p-0" ref={list}>
          <Key each={pins()} by="id">
            {(pin, at) => (
              <Pin
                pin={pin()}
                current={isCurrent(pin())}
                lifted={isLifted(at())}
                onGrab={(event) => grab(at(), event)}
                dragged={() => travelled}
                onRemove={() => unpin(pin())}
                onRename={() => askName({ kind: "rename", pin: pin() })}
              />
            )}
          </Key>
          <Show when={carrying()}>
            {(held) => (
              <li
                class="pointer-events-none absolute inset-x-1 h-0.5 rounded-control bg-accent"
                data-testid={TESTID.pinDropLine}
                data-gap={String(held().gap)}
                aria-hidden="true"
                style={{ top: `${held().rows.gaps[held().gap] ?? 0}px` }}
              />
            )}
          </Show>
        </ul>
      </section>
    </Show>
  )
}
