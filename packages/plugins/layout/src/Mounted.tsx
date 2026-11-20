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

/** MOUNT ORDER is the nesting order, outermost first. What it must NOT be is a
 *  `.map()` into siblings — these wrap, they do not sit beside each other. */
const chainOver = (
  faces: ReadonlyArray<Hung<SlotFaces["app.mount"]>>,
  page: () => JSX.Element,
): (() => JSX.Element) =>
  faces.reduceRight<() => JSX.Element>(
    (inner, one) => {
      const Mount = one.face
      return () => <Mount>{inner()}</Mount>
    },
    page,
  )
