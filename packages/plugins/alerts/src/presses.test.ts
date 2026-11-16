import { expect, test } from "bun:test"
import { createNotifications } from "./notify.ts"
import type { NotifyClick } from "./contract.ts"

const setup = (cold?: NotifyClick) => {
  let emit!: (value: NotifyClick) => void
  let subscriptions = 0, releases = 0
  const channel = createNotifications({
    permission: () => "granted",
    seam: {
      requestPermission: async () => true,
      show: async () => {},
      onClick: receive => { subscriptions++; emit = receive; if (cold) receive(cold); return () => { releases++ } },
    },
  })
  return { channel, emit: (value: NotifyClick) => emit(value), subscriptions: () => subscriptions, releases: () => releases }
}

test("one upstream listener holds the newest cold press, delivers once, and survives a released claim", () => {
  const old: NotifyClick = { kind: "ask" }, newer: NotifyClick = { kind: "ask" }
  const stage = setup(old)
  stage.emit(newer)
  const seen: NotifyClick[] = []
  const release = stage.channel.onPress("ask", value => seen.push(value))
  expect(seen).toEqual([newer]); expect(seen[0]).toBe(newer)
  release()
  const stop = stage.channel.onPress("ask", value => seen.push(value))
  expect(seen).toHaveLength(1)
  release() // An old release cannot remove the replacement.
  stage.emit(old)
  expect(seen).toHaveLength(2)
  stop()
  stage.emit(newer)
  stage.channel.onPress("ask", value => seen.push(value))
  expect(seen).toHaveLength(3)
  expect(stage.subscriptions()).toBe(1)
  stage.channel.dispose(); stage.channel.dispose()
  expect(stage.releases()).toBe(1)
})

test("a refused claim installs nothing and names the winner and newcomer", () => {
  const stage = setup()
  let count = 0
  const stop = stage.channel.onPress("ask", function winner() { count++ })
  expect(() => stage.channel.onPress("ask", function newcomer() {})).toThrow('claimed by winner; newcomer')
  stage.emit({ kind: "ask" }); expect(count).toBe(1)
  stop(); stage.channel.dispose()
})

test("withdrawal drops pending presses and rejects late copied dispatches", () => {
  const stage = setup({ kind: "ask" })
  stage.channel.dispose()
  let count = 0
  stage.channel.onPress("ask", () => count++)
  stage.emit({ kind: "ask" })
  expect(count).toBe(0); expect(stage.releases()).toBe(1)
})

test("a throwing pending handler leaves no stranded claim", () => {
  const stage = setup({ kind: "ask" })
  expect(() => stage.channel.onPress("ask", () => { throw new Error("failed") })).toThrow("failed")
  let count = 0
  stage.channel.onPress("ask", () => count++)
  expect(count).toBe(0)
  stage.emit({ kind: "ask" }); expect(count).toBe(1)
  stage.channel.dispose()
})

for (const order of [["ask", "due"], ["due", "ask"]] as const) {
  test(`two consumers receive their own kind, with ${order[0]} claimed first`, () => {
    const stage = setup({ kind: "due" })
    const seen: string[] = []
    const stops = order.map(kind => stage.channel.onPress(kind, value => seen.push(`${kind}:${value.kind}`)))
    expect(seen).toEqual(["due:due"])
    stage.emit({ kind: "ask" }); stage.emit({ kind: "due" })
    expect(seen).toEqual(["due:due", "ask:ask", "due:due"])
    expect(stage.subscriptions()).toBe(1)
    stops.forEach(stop => stop()); stage.channel.dispose()
  })
}

/**
 * THE THIRD KIND IS ROUTED LIKE THE OTHER TWO, and carries its word all the
 * way. The hold is per KIND, so a plugin press that waits for its claimant must
 * come out of the wait still naming the plugin it was raised for — a held press
 * that lost its name would open a page nobody asked about, which is the one
 * thing this arm's field exists to stop.
 */
test("a plugin press waits for its own claimant and arrives still named", () => {
  const stage = setup({ kind: "plugin", name: "hex-swatch" })
  const seen: NotifyClick[] = []
  stage.channel.onPress("ask", value => seen.push(value))
  expect(seen).toEqual([])
  stage.channel.onPress("plugin", value => seen.push(value))
  expect(seen).toEqual([{ kind: "plugin", name: "hex-swatch" }])
  stage.emit({ kind: "plugin", name: "colours" })
  expect(seen.at(-1)).toEqual({ kind: "plugin", name: "colours" })
  expect(stage.subscriptions()).toBe(1)
  stage.channel.dispose()
})
