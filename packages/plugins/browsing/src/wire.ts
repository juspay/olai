import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

export const name = "browsing"

export const BROWSER_PATH = "/browser"

export const WINDOW = { width: 1280, height: 800 } as const

export const VIEWPORT = { min: { width: 320, height: 240 }, max: { width: 3840, height: 2160 } } as const

export const clampViewport = (size: { readonly width: number; readonly height: number }): { readonly width: number; readonly height: number } => {
  const one = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)))
  return { width: one(size.width, VIEWPORT.min.width, VIEWPORT.max.width), height: one(size.height, VIEWPORT.min.height, VIEWPORT.max.height) }
}

export const Standing = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("absent"), why: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("down") }),
  Schema.Struct({ kind: Schema.Literal("starting") }),
  Schema.Struct({
    kind: Schema.Literal("up"),
    pid: Schema.Number,
    since: Schema.String,
  }),
  Schema.Struct({ kind: Schema.Literal("failed"), why: Schema.String }),
])
export type Standing = typeof Standing.Type
export const DOWN: Standing = { kind: "down" }

export const Tab = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  url: Schema.String,
})
export type Tab = typeof Tab.Type

export const ScreencastAsk = Schema.Struct({
  targetId: Schema.String,
  quality: Schema.Number,
})
export type ScreencastAsk = typeof ScreencastAsk.Type

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
    jpeg: Schema.String,
    meta: FrameMeta,
  }),
  Schema.Struct({ _tag: Schema.Literal("refused"), says: Schema.String }),
])
export type Frame = typeof Frame.Type

const Modifiers = Schema.Number

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
    text: Schema.String,
    keyCode: Schema.Number,
    modifiers: Modifiers,
  }),
  Schema.Struct({ kind: Schema.Literal("text"), text: Schema.String }),
])
export type InputEvent = typeof InputEvent.Type

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
    tabs: { keySchema: Schema.String, schema: Tab, verbs: ["keys", "get", "deltas"] },
  },
  streams: {
    screencast: { inputSchema: ScreencastAsk, outputSchema: Frame },
  },
  procedures: {
    tab: {
      input: { input: Schema.Struct({ targetId: Schema.String, event: InputEvent }), error: BrowserRefused },
      navigate: { input: Schema.Struct({ targetId: Schema.String, url: Schema.String }), error: BrowserRefused },
      resize: { input: Schema.Struct({ targetId: Schema.String, width: Schema.Number, height: Schema.Number }), error: BrowserRefused },
      open: { input: Nothing, output: OnTab, error: BrowserRefused },
      close: { input: OnTab, error: BrowserRefused },
    },
    browser: {
      start: { input: Nothing, error: BrowserRefused },
      forgetSignIns: { input: Nothing, error: BrowserRefused },
    },
  },
})

export const faces = {
  browser: {
    standing: "resource",
    tabs: "resource",
    screencast: "resource",
    "tab.input": "tool",
    "tab.navigate": "tool",
    "tab.resize": "tool",
    "tab.open": "tool",
    "tab.close": "tool",
    "browser.start": "tool",
    "browser.forgetSignIns": "tool",
  },
} as const
