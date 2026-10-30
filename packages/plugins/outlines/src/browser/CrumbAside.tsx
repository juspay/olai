import type {} from "../slots.ts"
import { For } from "solid-js"
import { TESTID } from "olai-plugin-outlines/testids"
import { crumbAsides } from "./faces.ts"

/**
 * WHAT A PLUGIN HANGS ON ONE CRUMB — chat's agent mark, on any ancestor that
 * is a node agent, and whatever another plugin learns to mark. The crumb is
 * the LINK to the ancestor's own page; this sits beside it and is the other
 * door (the ancestor's conversation), so it is a sibling rather than a child
 * of that link.
 *
 * `data-plugin` says WHOSE face this is, as it does on a row's aside: a
 * scenario asking whether a crumb kept its furniture has to be able to tell
 * what a plugin hung on it from what outlines drew (`./Asides.tsx` argues the
 * wrapper once for both).
 *
 * An unheld or empty table draws nothing at all, which is what makes a serve
 * with no chat row's crumbs look exactly as they did before this slot existed.
 */
export function CrumbAside(props: { readonly node: string }) {
  const faces = crumbAsides
  return <For each={faces()}>{(one) => {
    const Face = one.face
    return (
      <span class="contents" data-plugin={one.plugin} data-testid={TESTID.crumbAside}>
        <Face node={props.node} />
      </span>
    )
  }}</For>
}
