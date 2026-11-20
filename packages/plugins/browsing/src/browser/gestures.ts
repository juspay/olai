import type { FrameMeta, InputEvent } from "../wire.ts"

export interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export const pagePoint = (box: Box, meta: FrameMeta, clientX: number, clientY: number): { readonly x: number; readonly y: number } => {
  const fx = box.width > 0 ? (clientX - box.left) / box.width : 0
  const fy = box.height > 0 ? (clientY - box.top) / box.height : 0
  const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value))
  return { x: clamp(fx * meta.deviceWidth, meta.deviceWidth), y: clamp(fy * meta.deviceHeight, meta.deviceHeight) }
}

interface Mods {
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
}

export const modifiersOf = (event: Mods): number =>
  (event.altKey ? 1 : 0) | (event.ctrlKey ? 2 : 0) | (event.metaKey ? 4 : 0) | (event.shiftKey ? 8 : 0)

export const BUTTONS = ["left", "middle", "right"] as const

export const mouseOf = (
  type: Extract<InputEvent, { kind: "mouse" }>["type"],
  at: { readonly x: number; readonly y: number },
  event: Mods & { readonly button: number; readonly buttons: number; readonly detail: number },
  delta: { readonly deltaX: number; readonly deltaY: number } = { deltaX: 0, deltaY: 0 },
): InputEvent => ({
  kind: "mouse",
  type,
  x: at.x,
  y: at.y,
  button: type === "mousePressed" || type === "mouseReleased" ? BUTTONS[event.button] ?? "left" : "none",
  buttons: event.buttons,
  clickCount: type === "mousePressed" || type === "mouseReleased" ? Math.max(1, event.detail) : 0,
  modifiers: modifiersOf(event),
  deltaX: delta.deltaX,
  deltaY: delta.deltaY,
})

export const textOf = (event: Mods & { readonly key: string }): string => {
  if (event.ctrlKey || event.metaKey) return ""
  if (event.key === "Enter") return "\r"
  return event.key.length === 1 ? event.key : ""
}

export const keyOf = (
  type: "keyDown" | "keyUp",
  event: Mods & { readonly key: string; readonly code: string; readonly keyCode: number },
): InputEvent => ({
  kind: "key",
  type,
  key: event.key,
  code: event.code,
  text: type === "keyDown" ? textOf(event) : "",
  keyCode: event.keyCode,
  modifiers: modifiersOf(event),
})

export const keptByPane = (event: Mods & { readonly key: string }): "release" | "paste" | null => {
  if (event.key === "Escape") return "release"
  if ((event.ctrlKey || event.metaKey) && (event.key === "v" || event.key === "V")) return "paste"
  return null
}

export const addressOf = (typed: string): string => {
  const text = typed.trim()
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^(about|data|blob|javascript|view-source|mailto):/i.test(text)) return text
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(text)) return `http://${text}`
  if (/^[^\s/]+\.[^\s/]+/.test(text) || /^[^\s/]+:\d+(\/|$)/.test(text)) return `https://${text}`
  return `https://duckduckgo.com/?q=${encodeURIComponent(text)}`
}
