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

/** One ancestor: its title, then whatever a plugin hung on that crumb. A
 *  crumb the answer carried no id for cannot name a node for a face, so the
 *  face is not attempted rather than hung on a guess. */
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
  // The two parts are THIS line's opinion of the same list, not a second shape
  // travelled beside it: everything but the last crumb shrinks, the last is
  // protected. One render path draws either.
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
