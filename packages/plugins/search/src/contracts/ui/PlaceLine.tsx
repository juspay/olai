import type { Claims } from "@olai/format"
import type { Hung } from "@olai/plugin-api"
import type { NodeFace } from "olai-plugin-outlines/slots"
import { For, Show } from "solid-js"
import { renderTitle } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import type { Place, PlaceCrumb } from "./place.ts"

export type CrumbFaces = ReadonlyArray<Hung<NodeFace>>

/** Preserve both spaces even at the start of a flex item. */
const Separator = () => <span data-place="separator" class="shrink-0 whitespace-pre">{" · "}</span>

function Crumb(props: {
  readonly claims: Claims | undefined
  readonly crumb: PlaceCrumb
  readonly faces?: CrumbFaces
}) {
  return (
    <span class="inline-flex min-w-0 items-center gap-0.5">
      <TitleHtml class="min-w-0 truncate" drawing={renderTitle(props.claims, props.crumb.title, "", { links: false })} />
      <Show when={props.crumb.id}>
        {id => <For each={props.faces ?? []}>
          {(one) => {
            const Face = one.face
            return <span class="contents" data-plugin={one.plugin}><Face node={id()} /></span>
          }}
        </For>}
      </Show>
    </span>
  )
}

export function PlaceLine(props: {
  readonly claims: Claims | undefined; readonly place: Place; readonly testid?: string
  readonly faces?: CrumbFaces
}) {
  const middle = () => props.place.crumbs.slice(0, -1)
  const nearest = () => props.place.crumbs[props.place.crumbs.length - 1]
  return <span class="flex w-full min-w-0 overflow-hidden text-caption text-muted" data-testid={props.testid}>
    <span class="shrink-0" data-place="file">{props.place.file}</span>
    <Show when={middle().length > 0}>
      <span class="flex min-w-0 items-center overflow-hidden" data-place="middle"><Separator />
        <For each={middle()}>{(crumb, at) => <><Show when={at() > 0}><span class="shrink-0 whitespace-pre">{" · "}</span></Show><Crumb claims={props.claims} crumb={crumb} faces={props.faces} /></>}</For>
      </span>
    </Show>
    <Show when={nearest()}>{crumb => <span class="flex max-w-[45%] min-w-0 shrink-0 items-center overflow-hidden" data-place="nearest"><Separator /><Crumb claims={props.claims} crumb={crumb()} faces={props.faces} /></span>}</Show>
  </span>
}
