import type {} from "../slots.ts"
import { createMemo, For } from "solid-js"
import { hung } from "./faces.ts"

/** Each contributed face leaves with the row or page that owns its drawing —
 *  and each says WHOSE it is, which is the one thing that is not visible and
 *  the one thing its readers need.
 *
 * `data-plugin` is that fact, and it is worth a wrapper for the reason every
 * `data-` fact here is: a suite asking whether a ROW kept its elements has to
 * be able to tell the row's own furniture from what a plugin hung on it. The
 * face goes when ITS plugin does — that is not churn, it is the plugin leaving
 * — and a census that could not tell them apart read a plugin switching off as
 * the row being rebuilt (`@olai/tests`' `probe.ts` reads this attribute).
 *
 * `contents` so the wrapper is not a box: the face's own root stays the flex
 * item of the line it was hung on, which is what its own layout assumes. */
export function PluginAsides(props: { readonly node: string; readonly record?: string }) {
  const faces = createMemo(() => hung("outline.row.aside"))
  return <For each={faces()}>{(one) => {
    const Face = one.face
    return (
      <span class="contents" data-plugin={one.plugin}>
        <Face node={props.node} record={props.record} />
      </span>
    )
  }}</For>
}
