import { Show } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"
import type { FileControls } from "olai-plugin-files/contract"

const provider = heldService<FileControls>()

export const holdFileControls = provider.hold

export function DeleteFile(props: { readonly file: string }) {
  return <Show when={provider.read()?.Delete} keyed>{(Control) => <Control {...props} />}</Show>
}

export const openNewFile = (of: string): boolean => {
  const controls = provider.read()
  if (controls === undefined) return false
  controls.open(of)
  return true
}

export const canOpenNewFile = (): boolean => provider.read() !== undefined

export function NewFile(props: Parameters<FileControls["New"]>[0]) {
  return <Show when={provider.read()?.New} keyed>{(Control) => <Control {...props} />}</Show>
}
