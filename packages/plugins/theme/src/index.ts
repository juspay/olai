import { serviceTag } from "@olai/plugin-api/contracts"
import type { Accessor } from "solid-js"
import type { Palette } from "@olai/web/client/theme/palettes.ts"
import type { Typeface } from "@olai/fonts"
import type { TypeSize } from "@olai/web/client/theme/sizes.ts"

export const name = "theme"
export interface Choice<T> {
  readonly current: Accessor<T>
  readonly pick: (value: T) => void
}
export interface Appearance {
  readonly theme: Choice<Palette>
  readonly font: Choice<Typeface>
  readonly size: Choice<TypeSize>
}
export const appearance = serviceTag<Appearance>("theme.appearance")
