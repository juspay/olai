import { Dynamic } from "solid-js/web"
import { Index } from "solid-js"
import type { Claims } from "@olai/format"
import { createMemo, For, type JSX, Show } from "solid-js"

import { renderTitle, sameDrawing } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import { MARK_BOX } from "@olai/ui-primitives/mark.ts"

import type { Place } from "./place.ts"
import { PlaceLine, type CrumbFaces } from "./PlaceLine.tsx"
import type { NodeProp } from "olai-plugin-search/ui/props.ts"

export interface RowTestids {
  readonly row: string
  readonly place: string
  readonly prop?: string
}


export function Result(props: {
  readonly href?: string
  readonly onNavigate?: () => void
  readonly claims: Claims | undefined;
  readonly label: string
  readonly mark?: () => JSX.Element
  readonly hint?: string
  readonly place?: Place | string
  readonly props?: ReadonlyArray<NodeProp>
  readonly faces?: CrumbFaces
  readonly active: boolean
  readonly testids: RowTestids
  readonly id?: string
  readonly from?: string
  readonly needles?: ReadonlyArray<string>
  readonly onSelect: () => void
  readonly onHover: () => void
}) {
  const drawing = createMemo(
    () => {
      const from = props.from
      if (from === undefined) return undefined
      return renderTitle(props.claims, props.label, from, {
        needles: props.needles,
        // A link nested in this row's own anchor or button is invalid HTML.
        links: false,
      })
    },
    undefined,
    {
      equals: (was, now) =>
        was === undefined || now === undefined
          ? was === now
          : sameDrawing(was, now),
    },
  )
  return (
    <Dynamic component={props.href === undefined ? "button" : "a"}
      href={props.href}
      type={props.href === undefined ? "button" : undefined}
      class={`flex w-full min-w-0 flex-col rounded-control px-3 py-1.5 text-left text-body ${
        props.active ? "bg-ink/8 text-ink" : "text-ink hover:bg-ink/5"
      }`}
      data-testid={props.testids.row}
      data-id={props.id}
      data-active={props.active ? "true" : "false"}
      onMouseEnter={() => props.onHover()}
      // The default action of `mousedown` is what moves focus, so preventing it
      // keeps focus on the header's box and its panel up until `click` fires.
      onMouseDown={(event: MouseEvent) => event.preventDefault()}
      on:olai-navigated={() => props.onNavigate?.()}
      onClick={() => { if (props.href === undefined) props.onSelect() }}
    >
      <span class="flex w-full min-w-0 items-center gap-3">
        <span class="flex min-w-0 flex-1 items-center gap-2">
          <Show when={props.mark}>{(mark) => <span class={`${MARK_BOX} text-muted`}><Dynamic component={mark()} /></span>}</Show>
          <Show
            when={drawing()}
            fallback={
              <span class="min-w-0 flex-1 truncate">{props.label}</span>
            }
          >
            {(title) => (
              <TitleHtml drawing={title()} class="min-w-0 flex-1 truncate" />
            )}
          </Show>
        </span>
        <Show when={props.hint}>
          {(hint) => (
            <span class="shrink-0 text-caption text-muted">
              {hint()}
            </span>
          )}
        </Show>
      </span>
      <Show when={props.place}>
        {place => {
          const parts = () => { const value = place(); return typeof value === "string" ? undefined : value }
          return <Show when={parts()} fallback={<span class="w-full min-w-0 truncate text-caption text-muted" data-testid={props.testids.place}><TitleHtml drawing={renderTitle(props.claims, String(place()), "", { links: false })} /></span>}>
            {value => <PlaceLine claims={props.claims} place={value()} faces={props.faces} testid={props.testids.place} />}
          </Show>
        }}
      </Show>
      <Show when={(props.props ?? []).length > 0}>
        <span class="flex w-full min-w-0 gap-4 truncate text-caption">
          <Index each={props.props}>
            {(prop) => (
              <span
                class="min-w-0 truncate"
                data-testid={props.testids.prop}
                data-key={prop().key}
                data-matched={prop().matched ? "true" : undefined}
              >
                <span
                  class={`font-mono ${prop().matched ? "text-ink" : "text-muted"}`}
                >
                  {prop().key}
                </span>{" "}
                <span class="text-muted">{prop().value}</span>
              </span>
            )}
          </Index>
        </span>
      </Show>
    </Dynamic>
  )
}
