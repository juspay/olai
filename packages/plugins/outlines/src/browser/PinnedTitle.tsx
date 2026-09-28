/**
 * A phone's one-line reminder of WHICH node this page is.
 *
 * On a phone the page head scrolls away (`./NodePage.tsx`), because pinning
 * all of it left a transcript a few lines of screen. What a reader still needs
 * to see is the node's name, so once the display title has gone under the app
 * header this line takes its place: one line, truncated, and a tap takes you
 * back up to the head.
 *
 * The slot is ZERO HEIGHT and sticky, and the line hangs out of it, so the
 * line appearing moves nothing under the reader's thumb. Its observer belongs
 * to this component and is disconnected with it.
 */
import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { LAYER } from "@olai/web/client/layer.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { NodeTitle } from "./NodeTitle.tsx"

/** The app chrome's height, in pixels, as `--height-chrome` resolves here. */
const chromeOf = (at: HTMLElement): number => {
  const probe = at.appendChild(document.createElement("div"))
  probe.style.height = "var(--height-chrome)"
  const height = probe.getBoundingClientRect().height
  probe.remove()
  return height
}

export function PinnedTitle(props: {
  readonly title: string
  readonly from: string
  readonly heading: () => HTMLElement | undefined
}) {
  let slot!: HTMLDivElement
  const [away, setAway] = createSignal(false)
  onMount(() => {
    const heading = props.heading()
    if (heading === undefined) return
    const observer = new IntersectionObserver(
      ([entry]) => setAway(entry !== undefined && !entry.isIntersecting && entry.boundingClientRect.top < entry.rootBounds!.top + 1),
      { rootMargin: `-${chromeOf(slot)}px 0px 0px 0px` },
    )
    observer.observe(heading)
    onCleanup(() => observer.disconnect())
  })
  return (
    <div ref={slot} class={`sticky top-[var(--height-chrome)] ${LAYER.page} h-0 md:hidden`}>
      <Show when={away()}>
        <button
          type="button"
          class="block w-full truncate border-b border-rule bg-paper py-2 text-left font-serif text-base italic"
          data-testid={TESTID.zoomPinnedTitle}
          onClick={() => props.heading()?.scrollIntoView({ block: "center" })}
        >
          <NodeTitle title={props.title} from={props.from} links={false} />
        </button>
      </Show>
    </div>
  )
}
