/**
 * A phone's browser opens its camera for a file input's `capture` attribute;
 * everywhere else the attribute is ignored and the same markup opens an
 * ordinary file dialog. `capture` has no API behind it, so there is nothing to
 * probe for; `pointer: coarse` is the proxy, and a touchscreen laptop reports
 * its PRIMARY pointer as fine (its screen shows up under `any-pointer`).
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
