/**
 * Is the viewport at the phone layout breakpoint?
 *
 * `md` in this app is 48rem — the same line the sidebar stops being a column
 * (`App.tsx`, `touch.ts`). One matchMedia rather than two, so the layout and
 * the finger-size rule cannot disagree about where "phone" starts.
 *
 * Module-scoped signal so every reader (drawer, bottom sheet, rail) shares one
 * listener for the document's life.
 */

import { type Accessor, createSignal } from "solid-js"

/** Tailwind's `md` default, and this app's phone/desktop split. */
export const DESKTOP_MQ = "(min-width: 48rem)"

const [isDesktop, setIsDesktop] = createSignal(
  typeof window !== "undefined" && window.matchMedia(DESKTOP_MQ).matches,
)

let watching = false

/** Start the media listener. Idempotent; called from `main.tsx`. */
export const trackDesktop = (): void => {
  if (watching || typeof window === "undefined") return
  watching = true
  const mq = window.matchMedia(DESKTOP_MQ)
  const apply = () => setIsDesktop(mq.matches)
  apply()
  mq.addEventListener("change", apply)
}

export const desktop: Accessor<boolean> = isDesktop
