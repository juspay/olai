import type {} from "../slots.ts"
import type { NodeFace } from "../slots.ts"
import type { Hung } from "@olai/plugin-api"
import { For } from "solid-js"
import { rowAsides } from "./faces.ts"

/** ONE PLUGIN'S FACE, with the wrapper that says whose it is — the drawing a
 *  row, a page head or a CRUMB hosts, and the one place that fact is added.
 *
 *  `data-plugin` is that fact, and it is worth a wrapper for the reason every
 *  `data-` fact here is: a suite asking whether a ROW kept its elements has to
 *  be able to tell the row's own furniture from what a plugin hung on it. The
 *  face goes when ITS plugin does — that is not churn, it is the plugin leaving
 *  — and a census that could not tell them apart read a plugin switching off as
 *  the row being rebuilt (`@olai/tests`' `probe.ts` reads this attribute).
 *
 *  `contents` so the wrapper is not a box: the face's own root stays the flex
 *  item of the line it was hung on, which is what its own layout assumes. */
export function PluginFaces(props: {
  readonly faces: ReadonlyArray<Hung<NodeFace>>
  readonly node: string
  readonly record?: string
  /** A caller that wants to find ONE kind of face by test id; absent draws
   *  none, which is every row's case. */
  readonly testid?: string
}) {
  return <For each={props.faces}>{(one) => {
    const Face = one.face
    return (
      <span class="contents" data-plugin={one.plugin} data-testid={props.testid}>
        <Face node={props.node} record={props.record} />
      </span>
    )
  }}</For>
}

export function PluginAsides(props: { readonly node: string; readonly record?: string }) {
  return <PluginFaces faces={rowAsides()} node={props.node} record={props.record} />
}
