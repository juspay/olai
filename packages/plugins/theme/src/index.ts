import { serviceTag } from "@olai/plugin-api/contracts"
import type { Accessor } from "solid-js"
import type { Palette } from "@olai/appearance/palettes.ts"
import type { Typeface } from "@olai/fonts"
import type { TypeSize } from "@olai/appearance/sizes.ts"

export const name = "theme"
export interface Choice<T> {
  readonly current: Accessor<T>
  readonly pick: (value: T) => void
}
export interface Appearance {
  readonly chrome: { readonly name: (called: string) => void; readonly waiting: (value: boolean) => void }
  readonly theme: Choice<Palette>
  readonly font: Choice<Typeface>
  readonly size: Choice<TypeSize>
}
export const appearance = serviceTag<Appearance>("theme.appearance")
