/**
 * Is the viewport at the phone layout breakpoint?
 *
 * `md` in this app is 48rem — the same line the sidebar stops being a column
 * (`App.tsx`, `touch.ts`). One matchMedia rather than two, so the layout and
 * the finger-size rule cannot disagree about where "phone" starts.
 *
 * Module-scoped signal so every reader (drawer, bottom sheet, rail) shares one
 * reading, with its listener owned by the layout activation.
 */

import { type Accessor, createSignal } from "solid-js"

/** Tailwind's `md` default, and this app's phone/desktop split. */
export const DESKTOP_MQ = "(min-width: 48rem)"

const [isDesktop, setIsDesktop] = createSignal(
  typeof window !== "undefined" && window.matchMedia(DESKTOP_MQ).matches,
)

/** The layout activation owns this listener and refreshes it on reactivation. */
export const trackDesktop = (): (() => void) => {
  if (typeof window === "undefined") return () => {}
  const mq = window.matchMedia(DESKTOP_MQ)
  const apply = () => setIsDesktop(mq.matches)
  apply()
  mq.addEventListener("change", apply)
  return () => mq.removeEventListener("change", apply)
}

export const desktop: Accessor<boolean> = isDesktop
