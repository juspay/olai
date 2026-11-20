import { TESTID } from "olai-plugin-outlines/testids"
import type { Occasion, Status } from "@olai/format"
import { type JSX, Show } from "solid-js"

import { DateBadge } from "./DateBadge.tsx"
import { PluginAsides } from "./Asides.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import { RepeatBadge } from "./RepeatBadge.tsx"

import { toneOf } from "./tone.ts"
import { ROW_TITLE, SECTION_TITLE } from "@olai/ui-primitives/touch.ts"

export const TITLE_OPEN = "olai-title-open"

export function NodeLine(props: {
  readonly node: string
  readonly record?: string
  readonly title: string
  readonly from: string
  readonly status: Status | undefined
  readonly needles?: ReadonlyArray<string>
  readonly section?: boolean
  readonly open?: boolean
  readonly aside?: JSX.Element
  readonly took?: JSX.Element
  readonly mark?: JSX.Element
  readonly says?: string
  readonly occasion?: Occasion
  readonly overdue: boolean
  readonly children?: JSX.Element
  readonly onEdit?: (event: MouseEvent) => void
  readonly repeat?: string
  readonly onPickDate?: () => void
  readonly onPickRepeat?: () => void
  readonly titleEditor?: () => JSX.Element
}) {
  return (
    <>
      <span
        class="flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5 md:flex-nowrap"
        classList={{ "cursor-text": props.onEdit !== undefined }}
        onClick={(event) => props.onEdit?.(event)}
      >
        <span
          class={`min-w-0 break-words ${props.section === true ? SECTION_TITLE : ROW_TITLE} ${toneOf(props.status)}`}
          classList={{
            [TITLE_OPEN]: props.open === true,
          }}
          data-testid={TESTID.nodeTitle}
        >
          {props.children}
          <Show
            when={props.titleEditor}
            fallback={
              <NodeTitle title={props.title} from={props.from} needles={props.needles} />
            }
          >
            {(draw) => draw()()}
          </Show>
        </span>
        {props.mark}
        {props.aside}
        <Show when={props.says}>
          {(says) => (
            <DateBadge
              says={says()}
              occasion={props.occasion}
              overdue={props.overdue}
              onPick={props.onPickDate}
            />
          )}
        </Show>
        <Show when={props.repeat}>
          {(repeat) => <RepeatBadge repeat={repeat()} onPick={props.onPickRepeat} />}
        </Show>
        <PluginAsides node={props.node} record={props.record} />
        <span class="min-w-0 flex-1" aria-hidden="true" />
        {props.took}
      </span>
    </>
  )
}
