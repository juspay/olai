import { TESTID } from "olai-plugin-hypertext/testids"
import { heard, mediaHref } from "@olai/surface"
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js"

import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import type { Said } from "@olai/web/client/saying.ts"
import { Lede } from "@olai/web/client/errors/Lede.tsx"
import { servedDirectory } from "./vault.ts"
import { follow, targetOf, useHere, useLanding, useRouter, useShown } from "olai-plugin-navigation/routing"
import { fileNamed } from "olai-plugin-navigation/routes"

import { useHead } from "./vault.ts"
import { BodyRefused } from "olai-plugin-markdown/body-refused"
import { echo } from "./echo.ts"

const WALK_OFFS = 3

const SAYS_HELLO = 300

type Custody =
  | { readonly at: "asked"; readonly spoke: boolean }
  | { readonly at: "showing"; readonly spoke: boolean }
  | { readonly at: "greeted" }
  | { readonly at: "stray"; readonly until: ReturnType<typeof setTimeout> }

const PAGE_HEIGHT = "--page-height"

const VISIT = "olai-visit"

const REFUSED: Said = {
  tone: "alarm",
  text: "That link points to a file that isn't in this folder.",
}

const anchor = (at: string | undefined): string =>
  at === undefined || at === "" ? "" : `#${encodeURIComponent(at)}`

const UNMOVED = 2

const CORRECTING = 2_000

const scrollPort = (node: HTMLElement): HTMLElement | null => {
  let el: HTMLElement | null = node.parentElement
  while (el !== null && el !== document.documentElement) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY === "auto" || overflowY === "scroll") return el
    el = el.parentElement
  }
  return null
}

interface Pointed {
  readonly rev: number | undefined
  readonly at: string | undefined
}

function RefusedBody() {
  return (
    <section>
      <BodyRefused class="m-0 mb-2 italic text-alarm" />
      <Lede>
        This file couldn't be opened, so there's nothing to show.
      </Lede>
    </section>
  )
}

export function Hypertext(props: { readonly file: string }) {
  const shown = useShown()
  const rev = createMemo(useHead(() => props.file))
  const [measured, setMeasured] = createSignal<string>()
  const [refused, setRefused] = createSignal<Said>()
  const [unreadable, setUnreadable] = createSignal(false)
  const [landedAt, setLandedAt] = createSignal<number>()
  const router = useRouter(), here = useHere()
  const landing = useLanding(() => props.file)
  let frame: HTMLIFrameElement | undefined

  const heights = echo()
  let latest: number | undefined
  let sizing: number | undefined
  let walkOffs = 0
  let visits = 0
  let pointed: Pointed | undefined
  let stood: number | undefined
  let over = false
  let correcting: ReturnType<typeof setTimeout> | undefined
  const done = () => {
    over = true
    clearTimeout(correcting)
    correcting = undefined
  }
  let custody: Custody = { at: "showing", spoke: true }

  const stand = (next: Custody) => {
    if (custody.at === "stray") clearTimeout(custody.until)
    custody = next
  }

  const point = (url: string, arriving?: Pointed) => {
    if (frame === undefined) return
    fresh(arriving)
    stand({ at: "asked", spoke: false })
    frame.src = url
  }

  const fresh = (arriving?: Pointed) => {
    heights.fresh()
    latest = undefined
    if (sizing !== undefined) cancelAnimationFrame(sizing)
    sizing = undefined
    setRefused(undefined)
    setUnreadable(false)
    setLandedAt(undefined)
    stood = undefined
    clearTimeout(correcting)
    correcting = undefined
    over = false
    pointed = arriving
    if (arriving === undefined) setMeasured(undefined)
  }

  const reported = (height: number) => {
    latest = height
    if (sizing !== undefined) return
    sizing = requestAnimationFrame((at) => {
      sizing = undefined
      const said = latest
      if (!shown() || said === undefined || frame === undefined || said <= 0) return
      if (!heights.takes({ height: said, frame: frame.clientHeight, at })) return
      setMeasured(`${said}px`)
    })
  }

  createEffect(() => {
    if (shown() && latest !== undefined) reported(latest)
  })

  const show = () => {
    visits += 1
    const at = landing.owed()
    point(`${mediaHref(props.file)}?${VISIT}=${visits}${anchor(at)}`, { rev: rev(), at })
  }

  const bring = () => {
    walkOffs += 1
    if (walkOffs > WALK_OFFS) point("about:blank")
    else show()
  }

  const loaded = () => {
    if (custody.at === "asked") return stand({ at: "showing", spoke: custody.spoke })
    fresh()
    if (custody.at === "greeted") return stand({ at: "showing", spoke: true })
    stand({ at: "stray", until: setTimeout(bring, SAYS_HELLO) })
  }

  let frameLink: HTMLAnchorElement | undefined
  const clearLink = () => {
    frameLink?.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }))
    frameLink?.remove()
    frameLink = undefined
  }
  onCleanup(clearLink)
  createEffect(on(() => [shown(), rev(), landing.at()], clearLink, { defer: true }))
  const link = (said: Extract<ReturnType<typeof heard>, { kind: "link" }>) => {
    if (!shown() || !frame) return
    if (!frameLink || frameLink.getAttribute("href") !== said.href) {
      clearLink()
      frameLink = document.createElement("a")
      frameLink.href = said.href
      frameLink.tabIndex = -1
      frameLink.setAttribute("aria-hidden", "true")
      frameLink.style.cssText = "position:fixed;pointer-events:none;opacity:0"
      frame.parentElement?.append(frameLink)
    }
    const target = targetOf(router, frameLink)
    if (!target) return
    const route = target.destination.kind === "page" ? target.destination.route : undefined
    const named = route && fileNamed(route)
    if (named && !servedDirectory()?.paths().includes(named)) {
      if (said.action === "click") setRefused(REFUSED)
      return
    }
    const box = frame.getBoundingClientRect()
    const x = box.x + Math.max(0, Math.min(frame.clientWidth, said.x))
    const y = box.y + Math.max(0, Math.min(frame.clientHeight, said.y))
    Object.assign(frameLink.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, Math.min(frame.clientWidth, said.width))}px`, height: `${Math.max(0, Math.min(frame.clientHeight, said.height))}px` })
    if (said.action === "click") {
      const current = router.panes()[here()]?.route()
      if (said.intent === "go" && route && current && router.routes.href(current) === router.routes.href(route)) return
      if (said.intent) follow(target, said.intent)
      return
    }
    const options = { bubbles: true, cancelable: true, clientX: x, clientY: y }
    frameLink.dispatchEvent(said.action.startsWith("pointer") ? new PointerEvent(said.action, options) : new MouseEvent(said.action, options))
  }

  onMount(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow) return
      const said = heard(event.data)
      if (said === undefined) return
      if (said.kind === "refused") {
        setUnreadable(true)
        return
      }
      if (said.kind === "hello") {
        if (custody.at === "stray") stand({ at: "showing", spoke: true })
        else if (custody.at === "greeted") return
        else if (custody.spoke) stand({ at: "greeted" })
        else stand({ ...custody, spoke: true })
        return
      }
      if (said.kind === "link") return link(said)
      if (said.kind === "landed") return setLandedAt(said.top)
      reported(said.height)
    }
    window.addEventListener("message", listen)
    onCleanup(() => window.removeEventListener("message", listen))
  })

  createEffect(() => {
    clearTimeout(correcting)
    if (!shown()) return
    onCleanup(() => clearTimeout(correcting))
    const top = landedAt()
    const height = measured()
    if (top === undefined || frame === undefined || over) return
    if (pointed?.at === undefined || landing.at() === undefined) return
    const box = frame
    const at = pointed.at
    const painted = requestAnimationFrame(() => {
      if (stood !== undefined && Math.abs(box.getBoundingClientRect().top - stood) > UNMOVED) {
        return done()
      }
      if (!shown()) return
      box.scrollIntoView({ block: "start" })
      if (top !== 0) {
        const host = scrollPort(box)
        if (host === null) scrollBy({ top, behavior: "instant" })
        else host.scrollTop += top
      }
      stood = box.getBoundingClientRect().top
      if (height !== undefined) {
        clearTimeout(correcting)
        correcting = setTimeout(done, CORRECTING)
      }
      landing.landed(at)
    })
    onCleanup(() => cancelAnimationFrame(painted))
  })

  onCleanup(() => {
    if (custody.at === "stray") clearTimeout(custody.until)
    if (sizing !== undefined) cancelAnimationFrame(sizing)
    clearTimeout(correcting)
  })

  createEffect(
    on(() => [rev(), landing.at()] as const, ([now, at]) => {
      if (now === undefined) return
      if (at === undefined && pointed !== undefined && pointed.rev === now) return
      walkOffs = 0
      show()
    }, { defer: true }),
  )

  return (
    <>
      <Show when={refused()}>
        {(said) => (
          <SaidLine
            said={said()}
            class="mb-2 text-body leading-snug"
            testid={TESTID.hypertextSaid}
          />
        )}
      </Show>
      <Show when={unreadable()}>
        <RefusedBody />
      </Show>
      <iframe hidden={unreadable()}
      ref={(element) => {
        frame = element
        show()
      }}
      onLoad={loaded}
      // `allow-scripts` and NOTHING ELSE. What is absent is what matters:
      // without `allow-same-origin` the frame's origin is nobody's, so the
      // file's own scripts — which now run, and are the whole point — have no
      // cookies, no storage, no reach into this app's DOM. The pair
      // `allow-scripts allow-same-origin` is the combination that lets a framed
      // document take its own sandbox off, and it is the edit this attribute
      // exists to make obvious: ADDING A SECOND TOKEN HERE IS THE DIFFERENCE
      // between this component and a page that runs somebody's JavaScript in
      // this app's origin. The response says the same thing for a reader who
      // types the address instead (`seal.ts`'s `sandbox allow-scripts`), so the
      // guarantee does not depend on the frame being where the bytes are read.
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      title={props.file}
      style={{ [PAGE_HEIGHT]: measured() }}
      class="block h-[clamp(6rem,var(--page-height,70dvh),200dvh)] w-full rounded-control border border-rule bg-white"
      data-testid={TESTID.hypertextPreview}
      />

    </>
  )
}
