import { createSignal } from "solid-js"

import type { Accessor } from "solid-js"

import { createPreference, type PreferenceCodec } from "@olai/web/client/preference.ts"

import { DENSITY_KEY, type Density } from "../../contracts/preferences.ts"
export { DENSITY_KEY, type Density } from "../../contracts/preferences.ts"


export const DEFAULT_DENSITY: Density = "cozy"

const DENSITIES: ReadonlyArray<Density> = ["compact", "cozy", "open"]

const codec: PreferenceCodec<Density> = {
  parse: (raw) =>
    DENSITIES.find((one) => one === raw) ?? DEFAULT_DENSITY,
  print: (value) => value,
}

const makePref = () => createPreference(DENSITY_KEY, codec)
const [pref, setPref] = createSignal(makePref())

export const density: Accessor<Density> = () => pref().value()

export const setDensity = (value: Density): void => pref().set(value)

export const showsPreview = (value: Density): boolean => value === "cozy"

export const startsOpen = (value: Density): boolean => value === "open"

export const followDensity = (): (() => void) => {
  setPref(makePref())
  return pref().follow()
}
