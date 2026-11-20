import { Show } from "solid-js"
import { TESTID } from "olai-plugin-pins/testids"
import { CONTROL, SHOWN_WITHOUT_HOVER } from "@olai/ui-primitives/touch.ts"
import { Face } from "olai-plugin-navigation/address/Face.tsx"
import { LAYER } from "@olai/web/client/layer.ts"

import { ENTRY_SHAPE,ROW_GAP } from "olai-plugin-layout/entry"
import { useRouter } from "olai-plugin-navigation/routing"
import { Link } from "olai-plugin-navigation/routing"
import { Tip } from "@olai/web/client/Tip.tsx"
import type { Pin } from "./pins.ts"

const ROW = `relative ${ENTRY_SHAPE} ${ROW_GAP} w-full`

export function Pin(props: {
  readonly pin: Pin
  readonly current: boolean
  readonly lifted: boolean
  readonly onGrab: (event: PointerEvent) => void
  readonly dragged: () => boolean
  readonly onRemove: () => void
  readonly onRename: () => void
}) {
  const router = useRouter()
  const page = () => { const target = props.pin.target; return target.kind === "page" ? target.route : undefined }
  const href = () => { const target = props.pin.target; return target.kind === "page" ? router.routes.href(target.route) : router.routes.layoutHref(target.workspace) }
  return (
    <li
      class="group/pin relative mb-0.5"
      data-testid={TESTID.pin}
      data-pin={props.pin.id}
      data-at={href()}
      data-kind={props.pin.target.kind}
      data-lifted={props.lifted ? "true" : undefined}
      classList={{ "opacity-40": props.lifted }}
      onPointerDown={(event) => props.onGrab(event)}
      // The row is a link, and Chromium's own link-drag would claim the gesture
      // the moment the pointer travelled: the pointermoves stop arriving and
      // the reorder never happens.
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      on:click={{
        capture: true,
        handleEvent: (event: MouseEvent) => {
          if (!props.dragged()) return
          event.preventDefault()
          event.stopPropagation()
        },
      }}
    >
      <Show when={page()} fallback={
        <Tip text={props.pin.bare}>
          <a data-link-intent={props.pin.target.kind === "layout" ? "new-tab" : undefined} href={href()} class={ROW} data-testid={TESTID.pinLink}
            aria-current={props.current ? "page" : undefined} aria-label={`${props.pin.name}, ${props.pin.bare}`}>
            <Face target={props.pin.target} name={props.pin.name} />
          </a>
        </Tip>
      }>{(route) =>
        <Link route={route()} class={ROW} testid={TESTID.pinLink}
          current={props.current}>
          <Face target={props.pin.target} name={props.pin.name} />
        </Link>
      }</Show>
      <span
        class={`absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1.5 ${LAYER.row} ` +
          "rounded-control bg-desk px-1.5 py-1 opacity-0 shadow-raised transition-opacity " +
          `focus-within:opacity-100 group-hover/pin:opacity-100 ${SHOWN_WITHOUT_HOVER}`}
      >
        <Tip text="Rename">
          <button
            type="button"
            class={`${CONTROL} cursor-pointer rounded-control border-0 bg-transparent p-0 ` +
              "text-label leading-none text-muted hover:text-accent"}
            data-testid={TESTID.pinRename}
            aria-label={`Rename ${props.pin.name}`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              props.onRename()
            }}
          >
            ✎
          </button>
        </Tip>
        <Tip text="Unpin">
          <button
            type="button"
            class={`${CONTROL} cursor-pointer rounded-control border-0 bg-transparent p-0 ` +
              "text-label leading-none text-muted hover:text-alarm"}
            data-testid={TESTID.pinRemove}
            aria-label={`Unpin ${props.pin.name}`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              props.onRemove()
            }}
          >
            ×
          </button>
        </Tip>
      </span>
    </li>
  )
}
