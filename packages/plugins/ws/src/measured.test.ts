import { expect, test } from "bun:test"
import { RPC_MAX_FRAME_BYTES } from "@kolu/surface/frame-limit"
import { measured, type MeasurablePeer, type OverCap } from "./measured.ts"

/** A peer that records what it was sent and lets the test play the tab. */
class FakePeer extends EventTarget implements MeasurablePeer {
  readyState = 1
  readonly sent: Array<string | Uint8Array> = []
  readonly pongs = new Set<() => void>()
  closedWith: { code?: number; reason?: string } | undefined
  terminated = false
  send(data: string | Uint8Array): void { this.sent.push(data) }
  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason }
    this.readyState = 3
    this.dispatchEvent(new Event("close"))
  }
  terminate(): void { this.terminated = true }
  on(_: "pong", listener: () => void): unknown { this.pongs.add(listener); return this }
  off(_: "pong", listener: () => void): unknown { this.pongs.delete(listener); return this }
  /** The tab sent a frame. */
  frame(data: string | Uint8Array): void {
    const event = Object.assign(new Event("message"), { data })
    this.dispatchEvent(event)
  }
  pong(): void { for (const listener of this.pongs) listener() }
}

const setup = () => {
  let clock = 1_000
  const peer = new FakePeer()
  const over: Array<OverCap> = []
  const counted = measured(peer, { now: () => clock, overCap: (frame) => over.push(frame) })
  return { peer, over, counted, tick: (ms: number) => { clock += ms } }
}

test("counts frames and bytes each way, the largest sent, and the time since the tab last spoke", () => {
  const { peer, counted, tick } = setup()
  peer.frame("abcd")
  peer.frame(new Uint8Array(6))
  tick(100)
  peer.pong()
  counted.view.send("{\"_tag\":\"Exit\"}")
  counted.view.send("x".repeat(40))
  tick(250)
  expect(counted.measure()).toEqual({
    lived: 350,
    inFrames: 2,
    inBytes: 10,
    outFrames: 2,
    outBytes: 55,
    largestOut: 40,
    sincePong: 250,
    sinceInbound: 350,
  })
  expect(peer.sent).toEqual(["{\"_tag\":\"Exit\"}", "x".repeat(40)])
})

test("a tab that never spoke has no time since it did", () => {
  const { counted } = setup()
  const account = counted.measure()
  expect("sincePong" in account).toBe(false)
  expect("sinceInbound" in account).toBe(false)
})

test("a frame exactly at the cap passes; one code unit more is reported once, with its envelope", () => {
  const { counted, over } = setup()
  const head = "{\"_tag\":\"Chunk\",\"requestId\":\"41\",\"values\":[\""
  const at = head + "x".repeat(RPC_MAX_FRAME_BYTES - head.length)
  counted.view.send(at)
  expect(over).toEqual([])
  counted.view.send(at + "y")
  expect(over).toEqual([{ bytes: RPC_MAX_FRAME_BYTES + 1, cap: RPC_MAX_FRAME_BYTES, kind: "Chunk", request: "41" }])
  expect(counted.measure().largestOut).toBe(RPC_MAX_FRAME_BYTES + 1)
})

test("the view hands listeners, close and terminate to the peer, and leaves with it", () => {
  const { peer, counted } = setup()
  let heardClose = 0
  counted.view.addEventListener("close", () => { heardClose += 1 })
  expect(counted.view.readyState).toBe(1)
  counted.view.close(4001, "stale")
  expect(peer.closedWith).toEqual({ code: 4001, reason: "stale" })
  expect(heardClose).toBe(1)
  expect(counted.view.readyState).toBe(3)
  counted.view.terminate?.()
  expect(peer.terminated).toBe(true)
  // Its own listeners are gone: a frame or a pong after the close counts nothing.
  expect(peer.pongs.size).toBe(0)
  peer.frame("late")
  expect(counted.measure().inFrames).toBe(0)
})
