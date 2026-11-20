import type {} from "olai-plugin-layout/slots"
import { createMemo, type JSX, Show } from "solid-js"

import type { Hung, SlotFaces } from "@olai/plugin-api"

import { hung } from "./faces.ts"

export function PluginsMounted(props: { readonly children: JSX.Element }): JSX.Element {
  const mounts = createMemo(() => hung("app.mount"), undefined, {
    equals: (before, after) => before.length === after.length
      && before.every((one, index) => one.plugin === after[index]?.plugin
        && one.face === after[index]?.face),
  })
  return (
    <Show when={mounts()} keyed>
      {(faces) => chainOver(faces, () => props.children)()}
    </Show>
  )
}

/** Solid resolves a context against the owner the component was CREATED under,
 *  so each level's children are built by the mount above it, never before it. */
type LazyChildren = () => JSX.Element

const chainOver = (
  faces: ReadonlyArray<Hung<SlotFaces["app.mount"]>>,
  lazyChildren: LazyChildren,
): LazyChildren =>
  faces.reduceRight<LazyChildren>(
    (inner, one) => {
      const Mount = one.face
      return () => <Mount>{inner()}</Mount>
    },
    lazyChildren,
  )
