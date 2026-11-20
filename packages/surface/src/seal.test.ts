import { TEST_CLAIMS } from "@olai/format/testlib"
const FILE_EXTS = [...TEST_CLAIMS.byExt.keys()]
const SEAL = seal(FILE_EXTS)
import { expect, test } from "bun:test"

import { mediaHref } from "./media.ts"
import { intentOf, type Press } from "./press.ts"
import { BODY_REFUSED, heard, REFUSED_MARKUP, SEAL as seal, sealPolicy } from "./seal.ts"
const HOST = "127.0.0.1:4173"

const policy = (host: string = HOST): Record<string, ReadonlyArray<string>> => {
  const directives: Record<string, ReadonlyArray<string>> = {}
  for (const one of sealPolicy(host).split(";")) {
    const [name, ...sources] = one.trim().split(/\s+/)
    if (name !== undefined && name !== "") directives[name] = sources
  }
  return directives
}

const VAULT = [`http://${HOST}/media/`, `https://${HOST}/media/`]

const scriptsIn = (markup: string): ReadonlyArray<string> =>
  [...markup.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script(?:\s[^>]*)?>/gi)]
    .map((found) => found[1]!)

test("the seal is one route, one host, and an origin that is nobody's", () => {
  expect(policy()).toEqual({
    "sandbox": ["allow-scripts"],
    "default-src": VAULT,
    "script-src": [...VAULT, "'unsafe-inline'", "'unsafe-eval'"],
    "style-src": [...VAULT, "'unsafe-inline'"],
    "frame-src": ["'none'"],
    "form-action": ["'none'"],
    "base-uri": ["'none'"],
  })
})

test("a host that is not one gets no sources at all", () => {
  for (
    const host of [
      "a; img-src *",
      `a" onload="alert(1)`,
      "http://host",
      "host/media",
      "user:pw@host",
      "host?x=1",
      "host/",
      "",
    ]
  ) {
    const directives = policy(host)
    expect(directives["default-src"]).toEqual(["'none'"])
    expect(directives["script-src"]).toEqual(["'unsafe-inline'", "'unsafe-eval'"])
    expect(directives["style-src"]).toEqual(["'unsafe-inline'"])
    expect(sealPolicy(host)).toBe(sealPolicy("not a host"))
  }
})

test("the hosts this app is actually served on are spelled", () => {
  for (const host of ["127.0.0.1:4173", "localhost:8080", "olai.example.com", "[::1]:3000"]) {
    expect(policy(host)["default-src"]).toEqual([
      `http://${host}/media/`,
      `https://${host}/media/`,
    ])
  }
})

test("the seal opens with a doctype and carries exactly one script", () => {
  expect(SEAL.startsWith("<!doctype html>")).toBe(true)
  expect(scriptsIn(SEAL)).toHaveLength(1)
  expect(scriptsIn("<SCRIPT>alert(1)</SCRIPT>")).toEqual(["alert(1)"])
  expect(scriptsIn("<ScRiPt>alert(1)</sCrIpT>")).toEqual(["alert(1)"])
  expect(scriptsIn(`<script type="module">a</script>`)).toEqual(["a"])
  expect(scriptsIn("<script>a</script >")).toEqual(["a"])
  expect(scriptsIn("<script>a</script\t\n bar>")).toEqual(["a"])
  expect(scriptsIn(`<script>a</script foo="bar">`)).toEqual(["a"])
  expect(scriptsIn("<scriptish>a</scriptish>")).toEqual([])
  expect(scriptsIn("<script>a</scriptish>")).toEqual([])
})

test("the seal carries no policy and no base of its own", () => {
  expect(SEAL).not.toContain("Content-Security-Policy")
  expect(SEAL).not.toContain("<base")
})

const HEIGHT = ((): string => {
  const found = [...SEAL.matchAll(/\bvar tag = "([^"]*)"/g)]
  if (found.length !== 1) {
    throw new Error(`the measure names ${found.length} height tags, not one: ${SEAL}`)
  }
  return JSON.parse(`"${found[0]![1]!}"`) as string
})()

const HELLO = ((): string => {
  const found = /parent\.postMessage\("([^"]*)", "\*"\)/.exec(SEAL)
  if (found === null) throw new Error(`the measure sends no greeting: ${SEAL}`)
  return found[1]!
})()

test("a sealed document greets its embedder before it does anything else", () => {
  expect(heard(HELLO)).toEqual({ kind: "hello" })
  expect(SEAL.indexOf(`parent.postMessage("${HELLO}", "*")`))
    .toBeLessThan(SEAL.indexOf("addEventListener"))
})

test("only the greeting is the greeting", () => {
  for (
    const said of [
      undefined,
      null,
      42,
      "olai:page-sealed:",
      "olai:page-seal",
      "olai:page-height:640",
      { olai: "page-sealed" },
      "",
    ]
  ) {
    expect(heard(said)).not.toEqual({ kind: "hello" })
  }
})

const REFUSED = ((): string => {
  const found = /parent\.postMessage\("([^"]*)", "\*"\)/.exec(REFUSED_MARKUP)
  if (found === null) throw new Error(`the refused page sends no message: ${REFUSED_MARKUP}`)
  return found[1]!
})()

test("a refused page says so, and only the refusal is the refusal", () => {
  expect(REFUSED_MARKUP).toContain(BODY_REFUSED)
  expect(heard(REFUSED)).toEqual({ kind: "refused" })
  for (
    const said of [
      `${REFUSED}:`,
      "olai:page-refuse",
      HELLO,
      `${HEIGHT}640`,
    ]
  ) {
    expect(heard(said)).not.toEqual({ kind: "refused" })
  }
})

test("the frame's height message is the one the parser recognises", () => {
  expect(heard(`${HEIGHT}640`)).toEqual({ kind: "reading", height: 640 })
  expect(heard(`${HEIGHT}940`)).toEqual({ kind: "reading", height: 940 })
})

test("anything else the frame could say is not a height", () => {
  for (
    const said of [
      undefined,
      null,
      42,
      { olai: "page-height", height: 640 },
      HEIGHT,
      `${HEIGHT}tall`,
      `${HEIGHT}0`,
      `${HEIGHT}-40`,
      `${HEIGHT}Infinity`,
      "some-other-app:page-height:640",
      "olai:page-settled:640",
      "olai:page-loaded:940",
    ]
  ) {
    expect(heard(said)).toBeUndefined()
  }
})

test("the handler claims the kinds the registry says have pages", () => {
  const found = /var pages = (\[[^\]]*\])/.exec(SEAL)
  if (found === null) throw new Error(`the seal's link handler names no pages: ${SEAL}`)
  expect(JSON.parse(found[1]!)).toEqual([...FILE_EXTS])
})

const shipped = ((): ((press: Press) => ReturnType<typeof intentOf>) => {
  const found = /\n  var intentOf = ([\s\S]*?)\n  var localLink/.exec(SEAL)
  if (found === null) {
    throw new Error(`the seal ships no press rule — this test has nothing to check:\n${SEAL}`)
  }
  return new Function(`return (${found[1]!})`)() as (press: Press) => ReturnType<typeof intentOf>
})()

const BOTH = [false, true] as const
const PRESSES: ReadonlyArray<Press> = BOTH.flatMap((defaultPrevented) =>
  ([0, 1] as const).flatMap((button) =>
    BOTH.flatMap((metaKey) =>
      BOTH.flatMap((ctrlKey) =>
        BOTH.flatMap((shiftKey) =>
          BOTH.map((altKey) => ({
            defaultPrevented,
            button,
            metaKey,
            ctrlKey,
            shiftKey,
            altKey,
          }))
        )
      )
    )
  )
)

test("the press rule the seal ships is the press rule this app applies", () => {
  expect(PRESSES.filter((press) => shipped(press) !== intentOf(press))).toEqual([])
  expect(PRESSES.filter(press => intentOf(press) !== null)).toHaveLength(3)
})

test("anything else a frame could say is not a link", () => {
  for (
    const said of [
      undefined,
      null,
      42,
      { olai: "open-page", file: "notes/second.html" },
      { type: "some-other-app:link", href: "/second.html", action: "click", intent: "go", x: 0, y: 0, width: 0, height: 0 },
      `olai:open-page:${mediaHref("notes/second.html")}`,
      "some-other-app:open-page:/media/second.html",
    ]
  ) {
    expect(heard(said)).toBeUndefined()
  }
})

test("no one of the things a frame can say begins another", () => {
  const vocabulary = { HELLO, HEIGHT, REFUSED }
  const overlaps: Array<string> = []
  for (const [name, one] of Object.entries(vocabulary)) {
    for (const [other, another] of Object.entries(vocabulary)) {
      if (name === other) continue
      if (one.startsWith(another)) overlaps.push(`${name} begins with ${other}`)
    }
  }
  expect(overlaps).toEqual([])
})

test("a fractional page gets the pixel it needs", () => {
  expect(heard(`${HEIGHT}640.2`)).toEqual({ kind: "reading", height: 641 })
})

test("a slack spelling of a number is still a number", () => {
  expect(heard(`${HEIGHT} 640`)).toMatchObject({ height: 640 })
  expect(heard(`${HEIGHT}0x100`)).toMatchObject({ height: 256 })
})

test("a frame says where its anchor landed, zero and negative included", () => {
  const LANDED = ((): string => {
    const found = /parent\.postMessage\(\n?\s*"([^"]*)" \+ Math\.round/.exec(SEAL)
    if (found === null) throw new Error(`the measure reports no anchor: ${SEAL}`)
    return found[1]!
  })()
  expect(heard(`${LANDED}1298`)).toEqual({ kind: "landed", top: 1298 })
  expect(heard(`${LANDED}0`)).toEqual({ kind: "landed", top: 0 })
  expect(heard(`${LANDED}-40`)).toEqual({ kind: "landed", top: -40 })
  for (const said of [`${LANDED}`, `${LANDED}down`, `${LANDED}Infinity`]) {
    expect(heard(said)).toBeUndefined()
  }
  expect(heard(`${LANDED}1298`)?.kind).not.toBe("reading")
})

test("a frame that is resized says where the anchor is now, unasked", () => {
  const [script] = scriptsIn(SEAL)
  const said: string[] = []
  const listeners = new Map<string, () => void>()
  let anchor = 205
  const frame = {
    parent: { postMessage: (message: string) => said.push(message) },
    document: {
      documentElement: { offsetHeight: 1550 },
      body: { scrollHeight: 1550 },
      getElementById: (id: string) =>
        id === "beds" ? { getBoundingClientRect: () => ({ top: anchor }) } : null,
    },
    location: { hash: "#beds" },
    addEventListener: (kind: string, run: () => void) => listeners.set(kind, run),
    ResizeObserver: class {
      constructor(private readonly run: () => void) {}
      observe() {
        this.run()
      }
    },
  }
  new Function(...Object.keys(frame), script!)(...Object.values(frame))

  const fire = (kind: string): void => {
    const run = listeners.get(kind)
    if (run === undefined) {
      throw new Error(
        `the measure listens for no ${kind}, so nothing it could report would ` +
          `reach the embedder: ${[...listeners.keys()].join(", ")}`,
      )
    }
    run()
  }

  fire("DOMContentLoaded")
  fire("load")
  expect(said.map(heard)).toContainEqual({ kind: "landed", top: 205 })

  anchor = 1195
  said.length = 0
  fire("resize")

  expect(said.map(heard)).toEqual([{ kind: "landed", top: 1195 }])
})


test("sealed link reports validate gestures and finite anchor geometry", () => {
  const report = { type: "olai:link", href: "/#node", action: "click", intent: "right", x: 1, y: 2, width: 30, height: 20 }
  expect(heard(report)).toMatchObject({ kind: "link", href: "/#node", intent: "right" })
  for (const change of [{href: "//elsewhere/"}, {href: "javascript:evil()"}, {intent: "wrong"}, {action: "wrong"}, {x: Infinity}, {width: "30"}]) expect(heard({...report, ...change})).toBeUndefined()
})
