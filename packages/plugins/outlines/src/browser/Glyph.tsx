import { TESTID } from "olai-plugin-outlines/testids"
import type { InTheWay, Status } from "@olai/format"
import { Show } from "solid-js"

import { blockedBy, BULLET_TONE, Face, FACE, faceOf } from "@olai/web/client/marks.tsx"
import { Link } from "olai-plugin-navigation/routing"

import { Tip } from "@olai/web/client/Tip.tsx"
import { CONTROL } from "@olai/ui-primitives/touch.ts"
import { zoomNode } from "olai-plugin-navigation/routes"

export function Glyph(props: {
  readonly id: string
  readonly status: Status | undefined
  readonly blocked: ReadonlyArray<InTheWay>
  readonly collapsed?: boolean
  readonly holding?: boolean
}) {
  const halo = () => props.collapsed === true
  const face = () => faceOf(props.status, props.blocked)
  const waiting = () => face() === "waiting"
  const tone = (): string => {
    if (props.holding === true) return "text-accent"
    const status = props.status
    return status === undefined ? BULLET_TONE : FACE[status].tone
  }

  const Cell = () => (
    <Link
      route={zoomNode(props.id)}
      class={`${CONTROL} group/glyph relative select-none text-center no-underline ${tone()}`}
      testid={TESTID.zoom}
      label={named()}
      halo={halo()}
    >
      <span
        class="pointer-events-none absolute left-1/2 top-1/2 h-[0.95rem] w-[0.95rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-muted/60 bg-muted/10 group-hover/glyph:visible"
        classList={{ invisible: !halo() }}
        aria-hidden="true"
      />
      <Show
        when={props.status}
        fallback={
          <span class="relative group-hover/glyph:text-accent" aria-hidden="true">
            <Face face="bullet" />
          </span>
        }
      >
        {(status) => (
          <Show
            when={waiting()}
            fallback={
              <span
                class="relative"
                data-testid={TESTID.checkbox}
                data-status={status()}
                data-face={FACE[status()].face}
                aria-hidden="true"
              >
                <Face face={FACE[status()].face} />
              </span>
            }
          >
            <span
              class="relative"
              data-testid={TESTID.blocked}
              aria-hidden="true"
            >
              <span
                data-status={status()}
                data-face="waiting"
                data-blocked-by={props.blocked.map((one) => one.at.node.id).join(" ")}
              >
                <Face face="waiting" />
              </span>
            </span>
          </Show>
        )}
      </Show>
    </Link>
  )

  const said = (): string =>
    waiting()
      ? blockedBy(props.blocked)
      : props.status === undefined
      ? "Zoom in"
      : FACE[props.status].hint

  const named = (): string =>
    props.status === undefined ? "Zoom in" : `${said()}, zoom in`

  return (
    <Tip text={said()}><Cell /></Tip>
  )
}
