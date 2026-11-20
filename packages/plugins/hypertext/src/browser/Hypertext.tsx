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
import { custody } from "./custody.ts"

const BUDGET = {
  walkOffs: 3,
  helloMs: 300,
  readerMovedPx: 2,
  correctingMs: 2_000,
} as const

const PAGE_HEIGHT = {
  property: "--page-height",
  floor: "6rem",
  unmeasured: "70dvh",
  ceiling: "200dvh",
} as const

const FRAME_HEIGHT =
  `clamp(${PAGE_HEIGHT.floor}, var(${PAGE_HEIGHT.property}, ${PAGE_HEIGHT.unmeasured}), ${PAGE_HEIGHT.ceiling})`

const VISIT = "olai-visit"

const REFUSED: Said = {
  tone: "alarm",
  text: "That link points to a file that isn't in this folder.",
}

const anchor = (at: string | undefined): string =>
  at === undefined || at === "" ? "" : `#${encodeURIComponent(at)}`

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
  const [address, setAddress] = createSignal<string>()
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
  let settledTop: number | undefined
  let landingOver = false
  let correcting: ReturnType<typeof setTimeout> | undefined
  const endLanding = () => {
    landingOver = true
    clearTimeout(correcting)
    correcting = undefined
  }
  const custodian = custody({ helloMs: BUDGET.helloMs, strayed: () => bringBack() })

  const pointAt = (url: string, arriving?: Pointed) => {
    startOver(arriving)
    custodian.pointed()
    setAddress(url)
  }

  const startOver = (arriving?: Pointed) => {
    heights.fresh()
    latest = undefined
    if (sizing !== undefined) cancelAnimationFrame(sizing)
    sizing = undefined
    setRefused(undefined)
    setUnreadable(false)
    setLandedAt(undefined)
    settledTop = undefined
    clearTimeout(correcting)
    correcting = undefined
    landingOver = false
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

  const showFile = () => {
    visits += 1
    const at = landing.owed()
    pointAt(`${mediaHref(props.file)}?${VISIT}=${visits}${anchor(at)}`, { rev: rev(), at })
  }

  const bringBack = () => {
    walkOffs += 1
    if (walkOffs > BUDGET.walkOffs) pointAt("about:blank")
    else showFile()
  }

  const frameLoaded = () => {
    if (custodian.loaded() === "unasked") startOver()
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
      if (said.kind === "hello") return custodian.greeted()
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
    if (top === undefined || frame === undefined || landingOver) return
    if (pointed?.at === undefined || landing.at() === undefined) return
    const box = frame
    const at = pointed.at
    const painted = requestAnimationFrame(() => {
      if (settledTop !== undefined && Math.abs(box.getBoundingClientRect().top - settledTop) > BUDGET.readerMovedPx) {
        return endLanding()
      }
      if (!shown()) return
      box.scrollIntoView({ block: "start" })
      if (top !== 0) {
        const host = scrollPort(box)
        if (host === null) scrollBy({ top, behavior: "instant" })
        else host.scrollTop += top
      }
      settledTop = box.getBoundingClientRect().top
      if (height !== undefined) {
        clearTimeout(correcting)
        correcting = setTimeout(endLanding, BUDGET.correctingMs)
      }
      landing.landed(at)
    })
    onCleanup(() => cancelAnimationFrame(painted))
  })

  onCleanup(() => {
    custodian.release()
    if (sizing !== undefined) cancelAnimationFrame(sizing)
    clearTimeout(correcting)
  })

  createEffect(
    on(() => [rev(), landing.at()] as const, ([now, at]) => {
      if (now === undefined) return
      if (at === undefined && pointed !== undefined && pointed.rev === now) return
      walkOffs = 0
      showFile()
    }, { defer: true }),
  )

  showFile()

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
      }}
      src={address()}
      onLoad={frameLoaded}
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      title={props.file}
      style={{ [PAGE_HEIGHT.property]: measured(), height: FRAME_HEIGHT }}
      class="block w-full rounded-control border border-rule bg-white"
      data-testid={TESTID.hypertextPreview}
      />

    </>
  )
}
