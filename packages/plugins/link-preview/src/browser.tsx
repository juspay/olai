import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js"
import { Dynamic, Portal } from "solid-js/web"
import { Popper } from "@kobalte/core/popper"
import { navigation, linkPreviews, type Route, type LinkPreview } from "olai-plugin-navigation/contract"
import { PaneProvider } from "olai-plugin-navigation/pane"
import { RouterProvider, useFollow } from "olai-plugin-navigation/routing"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { overlays } from "olai-plugin-layout/contract"
import { LAYER } from "@olai/web/client/layer.ts"
import { name } from "./index.ts"
import { TESTID } from "./testids.ts"
import { matchPreview, OPEN_MS, CLOSE_MS } from "./matching.ts"

interface Target { readonly element: HTMLElement; readonly route: Route; readonly pane: number }
const CARD = "[data-link-preview]"
const EDITOR = '[contenteditable]:not([contenteditable="false"]), [data-editing="true"]'

export default definePlugin({ name, needs: [navigation, rendererSlots], apply: Effect.gen(function*() {
  const nav = yield* navigation
  const slots = yield* rendererSlots
  const [target, setTarget] = createSignal<Target>()
  let root: HTMLDivElement
  let opening: ReturnType<typeof setTimeout> | undefined
  let closing: ReturnType<typeof setTimeout> | undefined
  let pending: HTMLElement | undefined
  let insideCard = false
  const clearOpening = () => { clearTimeout(opening); opening = undefined; pending = undefined }
  const hold = () => { clearTimeout(closing); closing = undefined }
  const close = () => { clearOpening(); hold(); insideCard = false; setTarget(undefined) }
  const leave = () => { clearOpening(); hold(); closing = setTimeout(close, CLOSE_MS) }
  const classify = (at: EventTarget | null): Target | undefined => {
    if (!(at instanceof Element) || at.closest(`${CARD}, ${EDITOR}`)) return
    const element = at.closest<HTMLElement>('a[href], code[data-node-ref]')
    if (!element || element.closest(EDITOR)) return
    const href = element.getAttribute("href") ?? `/#${encodeURIComponent(element.dataset.nodeRef ?? "")}`
    const route = nav.routes.routeIn(href)
    const pane = element.closest("[data-pane]")?.getAttribute("data-pane")
    return route && matchPreview(slots.read(linkPreviews), route)
      ? { element, route, pane: pane === undefined || pane === null ? nav.focusIndex() : Number(pane) }
      : undefined
  }
  const enter = (event: PointerEvent | FocusEvent) => {
    if (matchMedia("(pointer: coarse)").matches || (event instanceof PointerEvent && event.pointerType === "touch")) return
    const inCard = event.target instanceof Element && event.target.closest(CARD) !== null
    if (event instanceof PointerEvent) insideCard = inCard
    if (inCard) { hold(); return }
    const next = classify(event.target)
    if (!next || (event.type === "focusin" && !next.element.matches(":focus-visible"))) return
    hold()
    if (target()?.element === next.element || pending === next.element) return
    clearOpening()
    if (event.type === "focusin") { setTarget(next); return }
    pending = next.element
    opening = setTimeout(() => {
      clearOpening()
      if (next.element.isConnected && classify(next.element)) setTarget(next)
    }, OPEN_MS)
  }
  const out = (event: PointerEvent | FocusEvent) => {
    if (!pending && !target()) return
    const next = event.relatedTarget
    if (event instanceof PointerEvent) insideCard = next instanceof Element && next.closest(CARD) !== null
    else if (insideCard) return
    if (next instanceof Node && (target()?.element.contains(next) || pending?.contains(next)
      || (next instanceof Element && next.closest(CARD)))) return
    leave()
  }
  const key = (event: KeyboardEvent) => { if (event.key === "Escape") close() }
  const activate = Effect.acquireRelease(Effect.sync(() => {
    root = document.createElement("div")
    root.dataset.linkPreviewOverlay = ""
    root.className = `fixed left-0 top-0 ${LAYER.over}`
    document.body.append(root)
    document.addEventListener("pointerover", enter)
    document.addEventListener("pointerout", out)
    document.addEventListener("focusin", enter)
    document.addEventListener("focusout", out)
    document.addEventListener("keydown", key)
  }), () => Effect.sync(() => {
    close()
    document.removeEventListener("pointerover", enter)
    document.removeEventListener("pointerout", out)
    document.removeEventListener("focusin", enter)
    document.removeEventListener("focusout", out)
    document.removeEventListener("keydown", key)
    root.remove()
  }))
  function Body(props: { readonly renderer: LinkPreview; readonly route: Route }) {
    const follow = useFollow()
    return <div class="max-h-80 overflow-hidden p-3" onClick={follow}><Dynamic component={props.renderer.Preview} route={props.route} /></div>
  }
  function Preview() {
    onCleanup(close)
    createEffect(on(() => nav.workspace(), close, { defer: true }))
    const matched = createMemo(() => { const at = target(); return at && matchPreview(slots.read(linkPreviews), at.route) })
    return <RouterProvider router={nav}><Show when={target()} keyed>{at =>
      <Show when={matched()} keyed>{renderer => {
        const [content, setContent] = createSignal<HTMLElement>()
        // Live edits can remove an anchor without a pointerout event. Its card
        // must release immediately, rather than reading at a detached element.
        const removed = new MutationObserver(() => { if (!at.element.isConnected) close() })
        removed.observe(document.body, { childList: true, subtree: true })
        onCleanup(() => removed.disconnect())
        return <Popper anchorRef={() => at.element} contentRef={content} placement="bottom-start" gutter={6}>
          <Portal mount={root}><Popper.Positioner>
            <aside ref={setContent} data-link-preview="" data-testid={TESTID.linkPreview}
              aria-label="Link preview" class="w-[min(24rem,90vw)] rounded-surface border border-rule/60 bg-panel shadow-raised text-ink">
              <PaneProvider index={at.pane} id={nav.panes()[at.pane]?.id}><Body renderer={renderer} route={at.route} /></PaneProvider>
              <footer class="border-t border-rule/60 px-3 py-2 text-xs text-muted">Click opens · Alt-click opens on the right <span class="float-right">read-only</span></footer>
            </aside>
          </Popper.Positioner></Portal>
        </Popper>
      }}</Show>
    }</Show></RouterProvider>
  }
  yield* slots.contribute(overlays, Preview, { children: [linkPreviews], activate })
}) })
