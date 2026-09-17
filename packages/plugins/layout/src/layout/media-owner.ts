/** The layout activation owns this listener and refreshes it on reactivation. */
import { DESKTOP_MQ } from "./media.ts"
import { publishDesktop } from "./live.ts"
export const trackDesktop = (): (() => void) => {
  if (typeof window === "undefined") return () => {}
  const mq = window.matchMedia(DESKTOP_MQ)
  const apply = () => publishDesktop(mq.matches)
  apply()
  mq.addEventListener("change", apply)
  return () => mq.removeEventListener("change", apply)
}

