/**
 * THE BROWSER PANE — the person's own browser, live, under their hand.
 *
 * A tab strip, an address bar, the page as a picture, and the gestures that
 * go back to it. The picture is the row's CDP screencast of that tab; a press,
 * a wheel, a key or a paste on it becomes CDP input on the same tab, in page
 * CSS px read off the frame it landed on (`./gestures.ts`). Keys go to the
 * page only while the viewer holds focus, which it says on its face; Escape
 * hands them back to the app.
 *
 * Every call is queued in order per pane, because a release that overtook its
 * press would be a different gesture. A refusal is shown in the pane's own
 * words line and is never thrown.
 */
import { Effect, Fiber, Stream } from "effect"
import { useGo } from "olai-plugin-navigation/routing"
import type { Route } from "olai-plugin-navigation/routes"
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js"
import { TESTID } from "../testids.ts"
import { clampViewport, type FrameMeta, type InputEvent, type Standing } from "../wire.ts"
import type { Browsing } from "./client.ts"
import { addressOf, keptByPane, keyOf, mouseOf, pagePoint } from "./gestures.ts"

export interface Shown {
  readonly targetId: string | null
}

/** A quality that keeps a busy 1280-wide page near 300 KB a frame. The
 *  frame's size is the viewport's, which follows this pane's box. */
const ASK = { quality: 60 } as const

/** How long a box must hold still before the viewport follows it: a drag of
 *  a split asks once, at the end, rather than once a frame. */
const SETTLE_MS = 150

const BUTTON = "rounded border border-rule px-2 py-0.5 text-caption hover:bg-ink/5 disabled:opacity-50"

/** One frame's JPEG as an object URL the page's image policy admits. */
const pictureOf = (base64: string): string => {
  const text = atob(base64)
  const bytes = new Uint8Array(text.length)
  for (let at = 0; at < text.length; at++) bytes[at] = text.charCodeAt(at)
  return URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }))
}

const sayOf = (failure: unknown): string => {
  const says = (failure as { readonly says?: unknown } | null)?.says
  if (typeof says === "string") return says
  return failure instanceof Error ? failure.message : String(failure)
}

export function BrowserPage(props: {
  readonly value: Shown
  readonly browsing: Browsing
  readonly href: (targetId: string | null) => string
  readonly route: (targetId: string | null) => Route
}) {
  const go = useGo()
  const standing = props.browsing.standing
  const calls = props.browsing.calls
  const [said, say] = createSignal<string | null>(null)
  const run = (effect: Effect.Effect<unknown, unknown>, done?: () => void) =>
    Effect.runPromise(effect).then(() => { say(null); done?.() }, (failure) => say(sayOf(failure)))

  const up = createMemo(() => { const now = standing(); return now.kind === "up" ? now.pid : null })
  const shown = createMemo(() => props.browsing.shown(props.value.targetId))
  const tab = () => { const id = shown(); return id === null ? undefined : props.browsing.tab(id) }

  // ONE SCREENCAST SUBSCRIPTION per pane, reopened when the shown tab or the
  // running browser changes and closed with the pane.
  //
  // Each picture is an OBJECT URL: the shell's image policy admits `blob:`
  // and, on purpose, not `data:`. A frame's URL is revoked as soon as the
  // next one replaces it, and the last one with the pane.
  const [frame, setFrame] = createSignal<{ readonly src: string; readonly meta: FrameMeta } | null>(null)
  const show = (next: { readonly src: string; readonly meta: FrameMeta } | null) => {
    const before = frame()
    setFrame(next)
    if (before !== null) URL.revokeObjectURL(before.src)
  }
  onCleanup(() => show(null))
  createEffect(on([shown, up, () => tab() !== undefined] as const, ([targetId, pid, open]) => {
    show(null)
    if (targetId === null || pid === null || !open) return
    const fiber = Effect.runFork(Stream.runForEach(props.browsing.watch({ targetId, ...ASK }), (got) => Effect.sync(() => {
      if (got._tag === "frame") show({ src: pictureOf(got.jpeg), meta: got.meta })
      else say(got.says)
    })).pipe(Effect.catchCause(() => Effect.void)))
    onCleanup(() => { void Effect.runPromise(Fiber.interrupt(fiber)) })
  }))

  // THE INPUT QUEUE: one chain per pane, in the order the gestures happened.
  let chain: Promise<unknown> = Promise.resolve()
  const send = (event: InputEvent) => {
    const targetId = shown()
    if (targetId === null) return
    chain = chain.then(() => run(calls.tab.input({ targetId, event })))
  }

  let picture: HTMLImageElement | undefined
  let viewer: HTMLDivElement | undefined
  const at = (event: { readonly clientX: number; readonly clientY: number }) => {
    const held = frame()
    if (held === null || picture === undefined) return null
    return pagePoint(picture.getBoundingClientRect(), held.meta, event.clientX, event.clientY)
  }
  let moving = 0
  const onMove = (event: PointerEvent) => {
    const point = at(event)
    if (point === null || moving !== 0) return
    // At most one move per animation frame: the page needs where the pointer
    // is, not every pixel it crossed.
    moving = requestAnimationFrame(() => { moving = 0; send(mouseOf("mouseMoved", point, event)) })
  }
  onCleanup(() => cancelAnimationFrame(moving))
  const onWheel = (event: WheelEvent) => {
    const point = at(event)
    if (point === null) return
    event.preventDefault()
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1
    send(mouseOf("mouseWheel", point, event, { deltaX: event.deltaX * scale, deltaY: event.deltaY * scale }))
  }

  // THE VIEWPORT FOLLOWS THIS PANE'S BOX, so a tall pane gets a tall page
  // rather than a 16:10 picture with nothing under it. Per tab: two panes on
  // one tab, the box asked last wins.
  const [box, setBox] = createSignal<{ readonly width: number; readonly height: number } | null>(null)
  createEffect(on([shown, up, box] as const, ([targetId, pid, size]) => {
    if (targetId === null || pid === null || size === null) return
    void run(calls.tab.resize({ targetId, ...size }))
  }))
  const measure = (element: HTMLElement) => {
    let settle = 0
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return
      clearTimeout(settle)
      settle = window.setTimeout(() => {
        const next = clampViewport(entry.contentRect)
        const held = box()
        if (held === null || held.width !== next.width || held.height !== next.height) setBox(next)
      }, SETTLE_MS)
    })
    observer.observe(element)
    onCleanup(() => { clearTimeout(settle); observer.disconnect() })
  }

  const [holding, hold] = createSignal(false)
  const onKey = (type: "keyDown" | "keyUp") => (event: KeyboardEvent) => {
    const kept = keptByPane(event)
    if (kept === "release") {
      event.preventDefault()
      if (type === "keyDown") viewer?.blur()
      return
    }
    if (kept === "paste") return
    event.preventDefault()
    send(keyOf(type, event))
  }
  const onPaste = (event: ClipboardEvent) => {
    event.preventDefault()
    const text = event.clipboardData?.getData("text/plain") ?? ""
    if (text !== "") send({ kind: "text", text })
  }

  // THE ADDRESS BAR shows the live URL until somebody types in it.
  const [typing, type] = createSignal<string | null>(null)
  createEffect(on(shown, () => type(null)))
  const navigate = () => {
    const targetId = shown()
    const url = typing()
    if (targetId === null || url === null || url.trim() === "") return
    type(null)
    void run(calls.tab.navigate({ targetId, url: addressOf(url) }))
  }

  const [confirming, confirm] = createSignal(false)

  return (
    <section class="flex h-full min-h-0 flex-col gap-2 p-3" aria-label="Browser" data-testid={TESTID.browserPage}
      data-standing={standing().kind} data-target={shown() ?? undefined} data-pid={up() ?? undefined}>
      {/* A failed start is the banner's to say: it is the standing. */}
      <Banner standing={standing()} start={() => void Effect.runPromise(Effect.ignore(calls.browser.start({}))).then(() => say(null))} />
      <Show when={up() !== null}>
        <nav class="flex flex-wrap items-center gap-1" aria-label="Browser tabs">
          <For each={props.browsing.tabs()}>{(one) => (
            <span class="flex max-w-[14rem] items-center gap-1 rounded border border-rule px-1.5 py-0.5 text-caption data-[active=true]:bg-ink/10"
              data-testid={TESTID.browserTab} data-target={one.id} data-active={one.id === shown() ? "true" : "false"}
              data-title={one.title}>
              <a href={props.href(one.id)} class="min-w-0 truncate" title={one.url}>{one.title || one.url || "New tab"}</a>
              <button type="button" class="text-muted hover:text-ink" aria-label={`Close ${one.title || "tab"}`}
                data-testid={TESTID.browserTabClose} onClick={() => void run(calls.tab.close({ targetId: one.id }))}>×</button>
            </span>
          )}</For>
          <button type="button" class={BUTTON} data-testid={TESTID.browserNewTab} aria-label="New tab"
            onClick={() => void run(Effect.map(calls.tab.open({}), ({ targetId }) => go(props.route(targetId))))}>+</button>
        </nav>
        <Show when={tab()} fallback={<p class="text-caption text-muted">
          {props.value.targetId === null ? "No tabs are open." : "This tab is no longer open."}
        </p>}>
          {(open) => (
            <>
              <input class="w-full rounded border border-rule bg-paper px-2 py-1 font-mono text-caption" aria-label="Address"
                data-testid={TESTID.browserAddress} spellcheck={false}
                value={typing() ?? open().url}
                onFocus={(event) => { type(open().url); event.currentTarget.select() }}
                onInput={(event) => type(event.currentTarget.value)}
                onBlur={() => type(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); navigate(); event.currentTarget.blur() }
                  if (event.key === "Escape") { type(null); event.currentTarget.blur() }
                }} />
              <div ref={(element) => {
                viewer = element
                measure(element)
                element.addEventListener("wheel", onWheel, { passive: false })
                onCleanup(() => element.removeEventListener("wheel", onWheel))
              }}
                class="relative min-h-0 flex-1 overflow-hidden rounded border border-rule outline-none focus:border-ink"
                tabindex={0} aria-label="Page" data-testid={TESTID.browserViewer} data-keys={holding() ? "page" : "app"}
                onFocus={() => hold(true)} onBlur={() => hold(false)}
                onKeyDown={onKey("keyDown")} onKeyUp={onKey("keyUp")} onPaste={onPaste}
                onContextMenu={(event) => event.preventDefault()}>
                <Show when={frame()} fallback={<p class="p-3 text-caption text-muted">Waiting for the page…</p>}>
                  {(held) => (
                    <img ref={picture} src={held().src} alt={open().title || "The page"} draggable={false}
                      class="mx-auto block h-auto max-h-full max-w-full select-none"
                      data-testid={TESTID.browserFrame}
                      onPointerDown={(event) => {
                        const point = at(event)
                        if (point === null) return
                        event.preventDefault()
                        viewer?.focus()
                        event.currentTarget.setPointerCapture(event.pointerId)
                        send(mouseOf("mouseMoved", point, event))
                        send(mouseOf("mousePressed", point, event))
                      }}
                      onPointerUp={(event) => { const point = at(event); if (point !== null) send(mouseOf("mouseReleased", point, event)) }}
                      onPointerMove={onMove} />
                  )}
                </Show>
              </div>
              <p class="text-caption text-muted" aria-live="polite">
                {holding() ? "Keys go to the page. Press Esc to give them back." : "Click the page to type into it."}
              </p>
            </>
          )}
        </Show>
      </Show>
      <Show when={said()}>{(words) => <p class="text-caption text-alarm" role="status" data-testid={TESTID.browserSaid}>{words()}</p>}</Show>
      <Show when={standing().kind !== "absent"}>
        <footer class="mt-auto flex flex-wrap items-center gap-2 text-caption">
          <Show when={confirming()} fallback={
            <button type="button" class={BUTTON} data-testid={TESTID.browserForget} onClick={() => confirm(true)}>Forget sign-ins</button>
          }>
            <span>Forget every sign-in this browser holds? It stops the browser and deletes its profile.</span>
            <button type="button" class={BUTTON} data-testid={TESTID.browserForgetConfirm}
              onClick={() => { confirm(false); void run(calls.browser.forgetSignIns({}), () => say("Sign-ins forgotten.")) }}>Forget them</button>
            <button type="button" class={BUTTON} onClick={() => confirm(false)}>Keep them</button>
          </Show>
        </footer>
      </Show>
    </section>
  )
}

function Banner(props: { readonly standing: Standing; readonly start: () => void }) {
  const line = (words: string, start: boolean) => (
    <p class="flex flex-wrap items-center gap-2 rounded border border-rule bg-panel px-3 py-2 text-caption" data-testid={TESTID.browserStanding}
      data-standing={props.standing.kind}>
      <span>{words}</span>
      <Show when={start}>
        <button type="button" class={BUTTON} data-testid={TESTID.browserStart} onClick={() => props.start()}>Start</button>
      </Show>
    </p>
  )
  return (
    <>
      {(() => {
        const standing = props.standing
        switch (standing.kind) {
          case "absent": return line(standing.why, false)
          case "down": return line("The browser is not running.", true)
          case "starting": return line("Starting the browser…", false)
          case "failed": return line(`The browser stopped: ${standing.why}`, true)
          case "up": return null
        }
      })()}
    </>
  )
}
