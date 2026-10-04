import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"
import { createEffect, createMemo, createSignal, createUniqueId, on, onCleanup, Show } from "solid-js"
import { Dynamic, Portal } from "solid-js/web"
import { Popper } from "@kobalte/core/popper"
import { navigation, linkPreviews, type Route, type LinkPreview } from "olai-plugin-navigation/contract"
import { PaneProvider } from "olai-plugin-navigation/pane"
import { RouterProvider } from "olai-plugin-navigation/routing"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { overlays } from "olai-plugin-layout/contract"
import { LAYER } from "@olai/web/client/layer.ts"
import { name } from "./index.ts"
import { TESTID } from "./testids.ts"
import { matchPreview } from "./matching.ts"
import { pointerEdges } from "./pointer.ts"

interface Target { readonly element: HTMLElement; readonly route: Route; readonly pane: number }
const OPEN_MS = 400
const CLOSE_MS = 200
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
  const [anchor, setAnchor] = createSignal<HTMLElement>()
  let insideCard = false
  const clearOpening = () => { clearTimeout(opening); opening = undefined; pending = undefined }
  const hold = () => { clearTimeout(closing); closing = undefined }
  const close = () => { clearOpening(); hold(); insideCard = false; setTarget(undefined) }
  const leave = () => { clearOpening(); hold(); closing = setTimeout(close, CLOSE_MS) }
  const classify = (at: EventTarget | null): Target | undefined => {
    if (!(at instanceof Element) || at.closest(`${CARD}, ${EDITOR}`)) return
    const element = at.closest<HTMLAnchorElement>('a[href]')
    if (!element || element.closest(EDITOR)) return
    const href = element.href
    const route = nav.routes.routeIn(href)
    const pane = element.closest("[data-pane]")?.getAttribute("data-pane")
    return route && matchPreview(slots.read(linkPreviews), route)
      ? { element, route, pane: pane === undefined || pane === null ? nav.focusIndex() : Number(pane) }
      : undefined
  }
  const enter = (event: PointerEvent | FocusEvent) => {
    if ((event.type === "focusin" && matchMedia("(pointer: coarse)").matches)
      || (event instanceof PointerEvent && event.pointerType === "touch")) return
    const inCard = event.target instanceof Element && event.target.closest(CARD) !== null
    if (event instanceof PointerEvent) insideCard = inCard
    if (inCard) { hold(); return }
    const next = classify(event.target)
    if (!next || (event.type === "focusin" && !next.element.matches(":focus-visible"))) return
    hold()
    if (anchor() === next.element || pending === next.element) return
    clearOpening()
    if (event.type === "focusin") { setTarget(next); return }
    pending = next.element
    opening = setTimeout(() => {
      clearOpening()
      if (next.element.isConnected && classify(next.element)) setTarget(next)
    }, OPEN_MS)
  }
  const pointer = pointerEdges<PointerEvent>(enter)
  const out = (event: PointerEvent | FocusEvent) => {
    if (!pending && !target()) return
    const next = event.relatedTarget
    if (event instanceof PointerEvent) insideCard = next instanceof Element && next.closest(CARD) !== null
    else if (insideCard) return
    if (next instanceof Node && (anchor()?.contains(next) || pending?.contains(next)
      || (next instanceof Element && next.closest(CARD)))) return
    leave()
  }
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !target()) return
    event.preventDefault()
    event.stopImmediatePropagation()
    close()
  }
  const activate = Effect.acquireRelease(Effect.sync(() => {
    const listeners = new AbortController()
    const options = { signal: listeners.signal }
    root = document.createElement("div")
    root.dataset.linkPreviewOverlay = ""
    root.className = `fixed left-0 top-0 ${LAYER.over}`
    document.body.append(root)
    document.addEventListener("pointerover", pointer.over, options)
    document.addEventListener("pointermove", pointer.move, options)
    document.addEventListener("pointerout", out, options)
    document.addEventListener("focusin", enter, options)
    document.addEventListener("focusout", out, options)
    document.addEventListener("keydown", key, { ...options, capture: true })
    return listeners
  }), listeners => Effect.sync(() => {
    close()
    listeners.abort()
    root.remove()
  }))
  function Body(props: { readonly renderer: LinkPreview; readonly route: Route }) {
    // The keyed target owns this mount and its immutable route contract.
    const route = props.route
    return <div data-testid={TESTID.linkPreviewBody} class="min-h-0 overflow-auto p-3 [overflow-wrap:anywhere]"><Dynamic component={props.renderer.Preview} route={route} /></div>
  }
  function Preview() {
    onCleanup(close)
    createEffect(on(() => nav.workspace(), close, { defer: true }))
    const matched = createMemo(() => { const at = target(); return at && matchPreview(slots.read(linkPreviews), at.route) })
    return <RouterProvider router={nav}><Show when={target()} keyed>{at =>
      <Show when={matched()} keyed>{renderer => {
        const cardId = `link-preview-${createUniqueId()}`
        const [content, setContent] = createSignal<HTMLElement>()
        setAnchor(at.element)
        onCleanup(() => setAnchor(undefined))
        createEffect(() => {
          const element = anchor()!
          const tokens = () => (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)
          element.setAttribute("aria-describedby", [...new Set([...tokens(), cardId])].join(" "))
          onCleanup(() => {
            const remaining = tokens().filter(token => token !== cardId)
            if (remaining.length) element.setAttribute("aria-describedby", remaining.join(" "))
            else element.removeAttribute("aria-describedby")
          })
        })
        // Live edits can remove an anchor without a pointerout event. Its card
        // must release immediately, rather than reading at a detached element.
        const parent = at.element.parentElement
        const href = at.element.getAttribute("href")
        const removed = new MutationObserver(() => {
          if (anchor()?.isConnected) return
          // Markdown can replace its HTML when membership changes. Follow the
          // same link in that owned block without remounting its live reading.
          const replacement = parent?.isConnected ? [...parent.querySelectorAll<HTMLElement>("a[href]")]
            .find(element => element.getAttribute("href") === href) : undefined
          if (!replacement) { close(); return }
          setAnchor(replacement)
        })
        // The source can be in a pane, sidebar or portal, all of which may
        // themselves be removed. Observing a descendant misses removal of that
        // root; body is their narrowest shared surviving ancestor. The callback
        // does no search while the current anchor is still connected.
        removed.observe(document.body, { childList: true, subtree: true })
        onCleanup(() => removed.disconnect())
        return <Popper anchorRef={anchor} contentRef={content} placement="bottom-start" gutter={6} fitViewport overflowPadding={8}>
          <Portal mount={root}><Popper.Positioner>
            <aside data-pane-id={nav.panes()[at.pane]?.id} id={cardId} ref={setContent} data-link-preview="" data-testid={TESTID.linkPreview}
              aria-label="Link preview" style={{ "max-height": "var(--kb-popper-content-available-height, calc(100dvh - 16px))" }}
              class="flex flex-col w-[min(24rem,90vw)] rounded-surface border border-rule/60 bg-panel shadow-raised text-ink">
              <PaneProvider index={at.pane} id={nav.panes()[at.pane]?.id}><Body renderer={renderer} route={at.route} /></PaneProvider>
              <footer class="shrink-0 border-t border-rule/60 px-3 py-2 text-xs text-muted">Click opens · Alt-click opens on the right <span class="float-right">read-only</span></footer>
            </aside>
          </Popper.Positioner></Portal>
        </Popper>
      }}</Show>
    }</Show></RouterProvider>
  }
  yield* slots.contribute(overlays, Preview, { children: [linkPreviews], activate })
}) })
