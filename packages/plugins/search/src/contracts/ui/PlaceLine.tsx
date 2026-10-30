/** The shared place drawing, including chat and title completions. */
import type { Claims } from "@olai/format"
import type { Hung } from "@olai/plugin-api"
import type { NodeFace } from "olai-plugin-outlines/slots"
import { For, Show } from "solid-js"
import { renderTitle } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import type { Place, PlaceCrumb } from "./place.ts"

/** WHAT A DOOR HANGS ON ONE CRUMB, read from `outline.crumb.aside` by the door
 *  that owns a faces holder. Passed as data rather than read here: this module
 *  is a contract door, and a holder at its module scope would publish live
 *  state across a package boundary (`@olai/bundle`'s fence names that shape).
 *  With none, the place line is the text it always was. */
export type CrumbFaces = ReadonlyArray<Hung<NodeFace>>

/** Preserve both spaces even at the start of a flex item. */
const Separator = () => <span data-place="separator" class="shrink-0 whitespace-pre">{" · "}</span>

/** One ancestor: its title, then whatever a plugin hung on that crumb. */
function Crumb(props: {
  readonly claims: Claims | undefined
  readonly crumb: PlaceCrumb
  readonly faces?: CrumbFaces
}) {
  return (
    <span class="inline-flex min-w-0 items-center gap-0.5">
      <TitleHtml class="min-w-0 truncate" drawing={renderTitle(props.claims, props.crumb.title, "", { links: false })} />
      <For each={props.faces ?? []}>
        {(one) => {
          const Face = one.face
          return <span class="contents" data-plugin={one.plugin}><Face node={props.crumb.id} /></span>
        }}
      </For>
    </span>
  )
}

export function PlaceLine(props: {
  readonly claims: Claims | undefined; readonly place: Place; readonly testid?: string
  readonly faces?: CrumbFaces
}) {
  return <span class="flex w-full min-w-0 overflow-hidden text-caption text-muted" data-testid={props.testid}>
    <span class="shrink-0" data-place="file">{props.place.file}</span>
    <Show when={props.place.middle}>{middle => <span class="flex min-w-0 items-center overflow-hidden" data-place="middle"><Separator />
      <Show when={props.place.middleCrumbs} fallback={
        <TitleHtml class="min-w-0 truncate" drawing={renderTitle(props.claims, middle(), "", { links: false })} />
      }>{crumbs =>
        <For each={crumbs()}>{(crumb, at) => <><Show when={at() > 0}><span class="shrink-0 whitespace-pre">{" · "}</span></Show><Crumb claims={props.claims} crumb={crumb} faces={props.faces} /></>}</For>
      }</Show>
    </span>}</Show>
    <Show when={props.place.nearest}>{nearest => <span class="flex max-w-[45%] min-w-0 shrink-0 items-center overflow-hidden" data-place="nearest"><Separator />
      <Show when={props.place.nearestCrumb} fallback={
        <TitleHtml class="min-w-0 truncate" drawing={renderTitle(props.claims, nearest(), "", { links: false })} />
      }>{crumb => <Crumb claims={props.claims} crumb={crumb()} faces={props.faces} />}</Show>
    </span>}</Show>
  </span>
}
