/**
 * Whether this device may offer a CAMERA beside the roll.
 *
 * A phone's browser sees a file input's `capture` attribute and opens the
 * camera itself; everywhere else the attribute is ignored and the same markup
 * opens an ordinary file dialog. There is no probe for `capture` (it has no
 * API behind it), so `pointer: coarse` is the proxy: a touchscreen laptop
 * reports its PRIMARY pointer as fine (its screen shows up under
 * `any-pointer`) and is excluded by definition.
 */

import { type Accessor, createSignal } from "solid-js"

const COARSE_MQ = "(pointer: coarse)"

const [offered, setOffered] = createSignal(
  typeof window !== "undefined" && window.matchMedia(COARSE_MQ).matches,
)

export const trackCamera = (): (() => void) => {
  if (typeof window === "undefined") return () => {}
  const mq = window.matchMedia(COARSE_MQ)
  const apply = () => setOffered(mq.matches)
  apply()
  mq.addEventListener("change", apply)
  return () => mq.removeEventListener("change", apply)
}

export const camera: Accessor<boolean> = offered
