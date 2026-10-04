import { intentOf } from "@olai/surface"
import { follow, targetOf, type NavigationRouter } from "./routing.tsx"

/** One activation-owned listener; Solid's document handlers settle the press first. */
export const followLinks = (navigation: NavigationRouter): (() => void) => {
  const click = (event: MouseEvent) => {
    const intent = intentOf(event)
    if (intent === null || !(event.target instanceof Element)) return
    const anchor = event.target.closest<HTMLAnchorElement>("a[href]")
    const target = anchor && targetOf(navigation, anchor)
    if (!target) return
    event.preventDefault()
    follow(target, intent)
  }
  window.addEventListener("click", click)
  return () => window.removeEventListener("click", click)
}
