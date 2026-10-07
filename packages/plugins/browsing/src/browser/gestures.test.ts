import { expect, test } from "bun:test"
import { keptByPane, keyOf, modifiersOf, mouseOf, pagePoint, textOf } from "./gestures.ts"

const meta = { deviceWidth: 1280, deviceHeight: 800, pageScaleFactor: 1, scrollOffsetX: 0, scrollOffsetY: 0, timestamp: 0 }
const none = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false }

test("a point on the drawn picture is the same fraction of the page's viewport", () => {
  const box = { left: 100, top: 50, width: 640, height: 400 }
  expect(pagePoint(box, meta, 100, 50)).toEqual({ x: 0, y: 0 })
  expect(pagePoint(box, meta, 420, 250)).toEqual({ x: 640, y: 400 })
  expect(pagePoint(box, meta, 740, 450)).toEqual({ x: 1280, y: 800 })
  // A pointer captured past the edge stays on the page.
  expect(pagePoint(box, meta, 2000, -10)).toEqual({ x: 1280, y: 0 })
})

test("modifiers are CDP's bits", () => {
  expect(modifiersOf(none)).toBe(0)
  expect(modifiersOf({ altKey: true, ctrlKey: true, metaKey: true, shiftKey: true })).toBe(15)
  expect(modifiersOf({ ...none, shiftKey: true })).toBe(8)
})

test("presses carry their button and click count; moves and wheels carry none", () => {
  const event = { ...none, button: 2, buttons: 2, detail: 2 }
  expect(mouseOf("mousePressed", { x: 1, y: 2 }, event)).toMatchObject({ type: "mousePressed", button: "right", clickCount: 2, buttons: 2 })
  expect(mouseOf("mouseMoved", { x: 1, y: 2 }, event)).toMatchObject({ button: "none", clickCount: 0 })
  expect(mouseOf("mouseWheel", { x: 1, y: 2 }, event, { deltaX: 0, deltaY: 120 })).toMatchObject({ deltaY: 120, button: "none" })
})

test("a key types its character, Enter a return, and a chord nothing", () => {
  expect(textOf({ ...none, key: "a" })).toBe("a")
  expect(textOf({ ...none, key: "Enter" })).toBe("\r")
  expect(textOf({ ...none, key: "ArrowLeft" })).toBe("")
  expect(textOf({ ...none, ctrlKey: true, key: "a" })).toBe("")
  expect(keyOf("keyUp", { ...none, key: "a", code: "KeyA", keyCode: 65 })).toMatchObject({ type: "keyUp", text: "" })
  expect(keyOf("keyDown", { ...none, shiftKey: true, key: "A", code: "KeyA", keyCode: 65 })).toEqual({
    kind: "key", type: "keyDown", key: "A", code: "KeyA", text: "A", keyCode: 65, modifiers: 8,
  })
})

test("Escape hands the keys back and a paste chord is left to the paste event", () => {
  expect(keptByPane({ ...none, key: "Escape" })).toBe("release")
  expect(keptByPane({ ...none, ctrlKey: true, key: "v" })).toBe("paste")
  expect(keptByPane({ ...none, metaKey: true, key: "V" })).toBe("paste")
  expect(keptByPane({ ...none, key: "v" })).toBeNull()
})
