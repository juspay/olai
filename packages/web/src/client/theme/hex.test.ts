import { describe, expect, test } from "bun:test"

import { channelsOf, hexOf, mixed, translucent } from "./hex.ts"

/**
 * The colour arithmetic, pinned directly.
 *
 * It was reached only through its callers — `contrast.test.ts` for the parsing,
 * `depth.test.ts` for the derivation — and one property of it is load-bearing in
 * a way no caller's assertion would name: `hexOf` may not use
 * `String.prototype.padStart(2, "0")`, because `packages/tests` injects a fault
 * into exactly that call to prove the client's error boundary catches a thrown
 * render, and the theme boot reaches this function OUTSIDE that boundary. A
 * refactor that reached for the obvious formatter would turn that scenario from
 * "the card is drawn" into "the bundle died", thirty seconds into an e2e run,
 * with nothing pointing here.
 */
describe("hex", () => {
  test("a colour is its three channels", () => {
    expect(channelsOf("#010AFF")).toEqual({ red: 1, green: 10, blue: 255 })
  })

  test("an alpha is dropped rather than misread", () => {
    // `chocolate`'s rule is the one translucent value in the table. What it
    // looks like depends on what is behind it, and neither caller has anything
    // behind it to ask about.
    expect(channelsOf("#A1836B53")).toEqual(channelsOf("#A1836B"))
  })

  test("a value that is not a colour is refused, not silently NaN", () => {
    expect(() => channelsOf("rebeccapurple")).toThrow()
    expect(() => channelsOf("#FFF")).toThrow()
  })

  test("a channel under 16 keeps its leading zero", () => {
    // THE pin. Two of the three channels here are single hex digits, so a
    // formatter that dropped the pad would answer `#1AFF` — and the whole reason
    // this is a comparison rather than `padStart` is the fault injection above.
    expect(hexOf({ red: 1, green: 10, blue: 255 })).toBe("#010AFF")
    expect(hexOf({ red: 0, green: 0, blue: 0 })).toBe("#000000")
  })

  test("a channel off either end is clamped rather than wrapped", () => {
    // The bisection can hand back a value a rounding step outside the range,
    // and a wrap would turn a near-white into a near-black.
    expect(hexOf({ red: -4, green: 255.4, blue: 300 })).toBe("#00FFFF")
  })

  test("the digits are upper-case, the way the palette table is written", () => {
    expect(hexOf({ red: 250, green: 250, blue: 246 })).toBe("#FAFAF6")
  })

  test("a mix at either end is that end, and the middle is the middle", () => {
    expect(mixed("#000000", "#FFFFFF", 0)).toBe("#000000")
    expect(mixed("#000000", "#FFFFFF", 1)).toBe("#FFFFFF")
    expect(mixed("#000000", "#FFFFFF", 0.5)).toBe("#808080")
  })

  test("a mix is channel-wise, not a blend of the whole", () => {
    // What `color-mix(in srgb, …)` does, which is what the generated stylesheet
    // has to agree with.
    expect(mixed("#FF0000", "#0000FF", 0.25)).toBe("#BF0040")
  })

  test("a translucent colour is the channels and the alpha as written", () => {
    expect(translucent("#15180F", 0.07)).toBe("rgb(21 24 15 / 0.07)")
  })
})
