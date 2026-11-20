
import { MEDIA_PREFIX } from "./media.ts"
import { intentOf, localLink, type Intent } from "./press.ts"

const READING = "olai:page-height:"

export const ROUNDING = 2

const HELLO = "olai:page-sealed"

const REFUSED = "olai:page-refused"

export const BODY_REFUSED = "This file could not be read."

export const REFUSED_MARKUP =
  `<body><p>${BODY_REFUSED}</p>` +
  `<script>parent.postMessage(${JSON.stringify(REFUSED)}, "*")</script></body>`

const LANDED = "olai:page-landed:"

const MEASURE = `(function () {
  parent.postMessage(${JSON.stringify(HELLO)}, "*")
  var tag = ${JSON.stringify(READING)}
  var measure = function () {
    var page = document.documentElement
    var body = document.body
    parent.postMessage(
      tag + Math.max(page.offsetHeight, body ? body.scrollHeight : 0),
      "*"
    )
    landed()
  }
  addEventListener("DOMContentLoaded", function () {
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(measure).observe(document.documentElement)
    } else {
      measure()
    }
    addEventListener("load", measure)
    addEventListener("resize", landed)
  })
  var landed = function () {
    var named = location.hash.slice(1)
    if (named === "") return
    var found = null
    try {
      found = document.getElementById(decodeURIComponent(named))
    } catch (_) {
      found = document.getElementById(named)
    }
    if (found === null) return
    parent.postMessage(
      ${JSON.stringify(LANDED)} + Math.round(found.getBoundingClientRect().top),
      "*"
    )
  }
})()`

const FOLLOW = (extensions: ReadonlyArray<string>) => `(function () {
  var pages = ${JSON.stringify(extensions)}
  var intentOf = ${intentOf.toString()}
  var localLink = ${localLink.toString()}
  function target(event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null
    if (!link || localLink(link)) return
    var at
    try { at = new URL(link.href) } catch (_) { return }
    if (at.protocol !== location.protocol || at.host !== location.host) return
    var path = at.pathname
    if (path.startsWith(${JSON.stringify(MEDIA_PREFIX)})) {
      if (!pages.some(function (extension) { return path.endsWith(extension) })) return
      path = "/" + path.slice(${MEDIA_PREFIX.length})
    }
    return { link: link, href: path + at.search + at.hash }
  }
  function report(event, action, intent) {
    var at = target(event)
    if (!at) return
    if (action === "click" || action === "contextmenu") event.preventDefault()
    var box = at.link.getBoundingClientRect()
    parent.postMessage({ type: "olai:link", href: at.href, action: action, intent: intent,
      x: box.x, y: box.y, width: box.width, height: box.height }, "*")
  }
  addEventListener("click", function (event) {
    var intent = intentOf(event)
    if (intent !== null) report(event, "click", intent)
  })
  addEventListener("contextmenu", function (event) {
    if (!event.defaultPrevented && !event.shiftKey) report(event, "contextmenu")
  })
  addEventListener("pointerover", function (event) { report(event, "pointerover") })
  addEventListener("pointerout", function (event) { report(event, "pointerout") })

})()`

export const SEAL = (extensions: ReadonlyArray<string>) => `<!doctype html>` +
  `<meta name="color-scheme" content="light">` +
  `<script>${MEASURE};${FOLLOW(extensions)}</script>`

/** The `Host` header lands unescaped in the policy, where a `;` opens a
 *  directive of the sender's choosing. Matched against the shape of a host
 *  rather than parsed: the URL parser's forbidden-host set excludes `;`, so
 *  `http://a;b` parses and round-trips as its own origin. */
const HOST = /^(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i

export const spellsHost = (host: string): boolean => HOST.test(host)

const sourcesOn = (host: string): ReadonlyArray<string> =>
  spellsHost(host)
    ? [`http://${host}${MEDIA_PREFIX}`, `https://${host}${MEDIA_PREFIX}`]
    : []

/** `'none'` is a source list only when it is the WHOLE of one: a browser
 *  ignores it beside any other source, so an empty list is spelled `'none'`
 *  and nothing else is. `form-action` and `base-uri` do not fall back to
 *  `default-src`. */
export const sealPolicy = (host: string): string => {
  const vault = sourcesOn(host)
  const from = (...keywords: ReadonlyArray<string>): string =>
    [...vault, ...keywords].join(" ") || `'none'`
  return `sandbox allow-scripts; ` +
    `default-src ${from()}; ` +
    `script-src ${from("'unsafe-inline'", "'unsafe-eval'")}; ` +
    `style-src ${from("'unsafe-inline'")}; ` +
    `frame-src 'none'; form-action 'none'; base-uri 'none'`
}

export type Said =
  | { readonly kind: "link"; readonly href: string; readonly action: "click" | "contextmenu" | "pointerover" | "pointerout"; readonly intent?: Intent; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  | { readonly kind: "hello" }
  | { readonly kind: "refused" }
  | { readonly kind: "reading"; readonly height: number }
  | { readonly kind: "landed"; readonly top: number }

export const heard = (said: unknown): Said | undefined => {
  if (typeof said === "object" && said !== null) {
    const message = said as Record<string, unknown>
    if (message.type === "olai:link") {
      if (typeof message.href !== "string" || !message.href.startsWith("/") || message.href.startsWith("//")) return undefined
      if (!["click", "contextmenu", "pointerover", "pointerout"].includes(String(message.action))) return undefined
      if (![message.x, message.y, message.width, message.height].every(value => typeof value === "number" && Number.isFinite(value))) return undefined
      if (message.action === "click" && !["go", "right", "new-pane"].includes(String(message.intent))) return undefined
      return { kind: "link", href: message.href, action: message.action, intent: message.intent,
        x: message.x, y: message.y, width: message.width, height: message.height } as Extract<Said, { kind: "link" }>
    }
    return undefined
  }
  if (said === HELLO) return { kind: "hello" }
  if (said === REFUSED) return { kind: "refused" }
  if (typeof said !== "string") return undefined
  if (said.startsWith(LANDED)) {
    const tail = said.slice(LANDED.length)
    const top = Number(tail)
    return tail.trim() !== "" && Number.isFinite(top)
      ? { kind: "landed", top }
      : undefined
  }
  if (!said.startsWith(READING)) return undefined
  const height = Number(said.slice(READING.length))
  return Number.isFinite(height) && height > 0
    ? { kind: "reading", height: Math.ceil(height) }
    : undefined
}
