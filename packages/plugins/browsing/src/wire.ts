/**
 * THE BROWSING ROW'S OWN SURFACE — the person's view of, and hand on, the
 * browser olai keeps for this served directory.
 *
 * Composed by core under this plugin's name, so `standing` is
 * `surface/browsing/standing/get` on the wire with no name arithmetic here.
 * Like every `./wire` door in this tree it may import the framework and
 * `effect` and nothing else: the server and the tab both read it statically.
 *
 * ## The first live face here that writes back to what it shows
 *
 * Kolu's pane is read-only because a terminal is the agent's hand, and a tab
 * that typed into it would be a second author in a conversation nobody can
 * see. This browser is the other way round: it is the PERSON'S — their
 * sign-ins live in its profile — and the agents are guests attached to it over
 * CDP. So the pane clicks, types, pastes and navigates, and the agents keep
 * their own Playwright for doing the same.
 */
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

/** The sibling key, the preferences row, and the docs slug. */
export const name = "browsing"

/** The pane's own address, which chat's roster chip links to. */
export const BROWSER_PATH = "/browser"

/** The headless window olai launches Chromium at. The pane asks for frames
 *  at its width, so a picture is never upscaled. */
export const WINDOW = { width: 1280, height: 800 } as const

/**
 * WHERE THE BROWSER STANDS. `absent` is a serve with no Chromium configured
 * (`OLAI_BROWSER_CHROMIUM` blank) and never changes while the row stands; the
 * other four are the lazy launch's life: nothing has asked yet, a launch is in
 * flight, it is up, or the last one failed and the next demand tries again.
 */
export const Standing = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("absent"), why: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("down") }),
  Schema.Struct({ kind: Schema.Literal("starting") }),
  Schema.Struct({
    kind: Schema.Literal("up"),
    /** The Chromium process olai launched and will stop. */
    pid: Schema.Number,
    /** ISO-8601, when it came up. */
    since: Schema.String,
  }),
  Schema.Struct({ kind: Schema.Literal("failed"), why: Schema.String }),
])
export type Standing = typeof Standing.Type
export const DOWN: Standing = { kind: "down" }

/** One open page in the browser — the person's tabs and every agent's. */
export const Tab = Schema.Struct({
  /** The CDP target id, which is also the pane's address word. */
  id: Schema.String,
  title: Schema.String,
  url: Schema.String,
})
export type Tab = typeof Tab.Type

/** What the pane asks a screencast for. The frame is scaled by the browser to
 *  `maxWidth` CSS px wide at most, JPEG at `quality` (0–100). */
export const ScreencastAsk = Schema.Struct({
  targetId: Schema.String,
  maxWidth: Schema.Number,
  quality: Schema.Number,
})
export type ScreencastAsk = typeof ScreencastAsk.Type

/** The page's geometry as one frame was painted — what maps a pointer on the
 *  picture back to the page. */
export const FrameMeta = Schema.Struct({
  deviceWidth: Schema.Number,
  deviceHeight: Schema.Number,
  pageScaleFactor: Schema.Number,
  scrollOffsetX: Schema.Number,
  scrollOffsetY: Schema.Number,
  timestamp: Schema.Number,
})
export type FrameMeta = typeof FrameMeta.Type

export const Frame = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal("frame"),
    /** Base64 JPEG, as CDP hands it over. */
    jpeg: Schema.String,
    meta: FrameMeta,
  }),
  /** There is no picture to give, in a sentence: no such tab, a browser that
   *  is not up, or one that went away under the pane. The stream ends after. */
  Schema.Struct({ _tag: Schema.Literal("refused"), says: Schema.String }),
])
export type Frame = typeof Frame.Type

/** Modifier bits, as CDP counts them: Alt 1, Ctrl 2, Meta 4, Shift 8. */
const Modifiers = Schema.Number

/**
 * ONE GESTURE ON THE PAGE. Mouse coordinates are CSS px in the page's
 * viewport — the pane maps them off the frame it drew, so the server does no
 * geometry. Keys carry what a DOM `KeyboardEvent` says; `text` is a paste.
 */
export const InputEvent = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("mouse"),
    type: Schema.Literals(["mouseMoved", "mousePressed", "mouseReleased", "mouseWheel"]),
    x: Schema.Number,
    y: Schema.Number,
    button: Schema.Literals(["none", "left", "middle", "right"]),
    buttons: Schema.Number,
    clickCount: Schema.Number,
    modifiers: Modifiers,
    deltaX: Schema.Number,
    deltaY: Schema.Number,
  }),
  Schema.Struct({
    kind: Schema.Literal("key"),
    type: Schema.Literals(["keyDown", "keyUp"]),
    key: Schema.String,
    code: Schema.String,
    /** What the key types, if it types anything — absent for Enter's
     *  siblings, arrows and modifiers. */
    text: Schema.String,
    keyCode: Schema.Number,
    modifiers: Modifiers,
  }),
  Schema.Struct({ kind: Schema.Literal("text"), text: Schema.String }),
])
export type InputEvent = typeof InputEvent.Type

/** A gesture the browser could not take, in a sentence the pane shows. */
export class BrowserRefused extends Schema.TaggedError<BrowserRefused>(
  "olai-plugin-browsing/BrowserRefused",
)("BrowserRefused", { says: Schema.String }) {
  override get message(): string {
    return this.says
  }
}

const OnTab = Schema.Struct({ targetId: Schema.String })
const Nothing = Schema.Struct({})

export const surface = defineSurface({
  cells: {
    standing: { schema: Standing, default: DOWN, verbs: ["get"] },
  },
  collections: {
    /** Page targets only: the person's tabs and every agent's, kept live off
     *  CDP's `Target.*` events. */
    tabs: { keySchema: Schema.String, schema: Tab, verbs: ["keys", "get", "deltas"] },
  },
  streams: {
    /** One subscription per open pane; the row runs one CDP screencast per
     *  tab however many panes watch it, and none once the last one leaves. */
    screencast: { inputSchema: ScreencastAsk, outputSchema: Frame },
  },
  procedures: {
    tab: {
      input: { input: Schema.Struct({ targetId: Schema.String, event: InputEvent }), error: BrowserRefused },
      navigate: { input: Schema.Struct({ targetId: Schema.String, url: Schema.String }), error: BrowserRefused },
      open: { input: Nothing, output: OnTab, error: BrowserRefused },
      close: { input: OnTab, error: BrowserRefused },
    },
    browser: {
      start: { input: Nothing, error: BrowserRefused },
      forgetSignIns: { input: Nothing, error: BrowserRefused },
    },
  },
})

/**
 * WHICH FACE SEES WHAT: all of it the browser's, and NO AGENT MAP.
 *
 * Every member is the person's view of, or hand on, their own browser. An
 * agent already drives the same browser through its own Playwright MCP, which
 * this row hands it; re-serving clicks and keys through olai's `/mcp` would be
 * a second, unreviewed way in. `exposeFaces` denies a face with no map in
 * full, which is the default-deny wanted here.
 */
export const faces = {
  browser: {
    standing: "resource",
    tabs: "resource",
    screencast: "resource",
    "tab.input": "tool",
    "tab.navigate": "tool",
    "tab.open": "tool",
    "tab.close": "tool",
    "browser.start": "tool",
    "browser.forgetSignIns": "tool",
  },
} as const
