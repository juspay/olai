import { expect, test } from "bun:test"
import type { SubscriptionLiveness } from "@kolu/surface/subscriptions"
import { RPC_MAX_FRAME_BYTES } from "@kolu/surface/frame-limit"
import { type Entry, type LinkEvent, SAY_AGAIN_AFTER_MS } from "@olai/log/link"
import { createDiary, type Diary, SETTLE_MS } from "./diary.ts"
import { createOutbox } from "./outbox.ts"
import { tappedSocket } from "./socket.ts"

/** A diary on a clock and timers the test moves by hand. */
const setup = (liveness: () => ReadonlyArray<SubscriptionLiveness> = () => []) => {
  let clock = 1_000_000
  const timers: Array<{ at: number; run: () => void; live: boolean }> = []
  const printed: Array<Entry> = []
  const diary = createDiary({
    tab: "0123456789abcdef",
    now: () => clock,
    online: () => true,
    hidden: () => false,
    liveness,
    timers: {
      set: (run, ms) => {
        const timer = { at: clock + ms, run, live: true }
        timers.push(timer)
        return () => { timer.live = false }
      },
    },
    outbox: createOutbox(),
    print: (entry) => printed.push(entry),
  })
  const advance = (ms: number) => {
    clock += ms
    for (const timer of timers) {
      if (timer.live && timer.at <= clock) {
        timer.live = false
        timer.run()
      }
    }
  }
  const said = <T extends LinkEvent["_tag"]>(tag: T) =>
    printed.filter((entry): entry is Entry & { event: Extract<LinkEvent, { _tag: T }> } => entry.event._tag === tag)
  return { diary, advance, said, timers }
}

/** Enough of a browser WebSocket for the tap. */
class FakeSocket extends EventTarget {
  readyState = 0
  readonly sent: Array<unknown> = []
  send(data: unknown): void { this.sent.push(data) }
  close(code = 1000, reason = ""): void {
    this.readyState = 2
    this.closed(code, reason, true)
  }
  open(): void {
    this.readyState = 1
    this.dispatchEvent(new Event("open"))
  }
  frame(data: string): void { this.dispatchEvent(Object.assign(new Event("message"), { data })) }
  closed(code: number, reason = "", wasClean = false): void {
    this.readyState = 3
    this.dispatchEvent(Object.assign(new Event("close"), { code, reason, wasClean }))
  }
}

const dial = (diary: Diary) => {
  const fake = new FakeSocket()
  const socket = tappedSocket(fake as unknown as WebSocket, diary.dialled())
  return { fake, socket }
}

test("a socket through the tap: counted, closed by the page, and said once it settles", () => {
  const { diary, advance, said } = setup()
  const { fake, socket } = dial(diary)
  advance(30)
  fake.open()
  fake.frame("abcd")
  fake.frame("abcdefgh")
  socket.send("xyz")
  advance(1_900)
  socket.close(1000)
  expect(() => socket.send("late")).toThrow("The socket is not open")
  expect(said("Dropped")).toHaveLength(0)
  advance(SETTLE_MS)

  expect(said("Dialling")).toHaveLength(1)
  expect(said("Opened")[0]!.event).toEqual({ _tag: "Opened", took: 30, recovered: false })
  const [dropped] = said("Dropped")
  expect(dropped!.dial).toBe(1)
  expect(dropped!.event).toMatchObject({
    cause: "severed",
    code: 1000,
    clean: true,
    lived: 1_900,
    silent: 1_900,
    inFrames: 2,
    inBytes: 12,
    largestIn: 8,
    outFrames: 1,
    outBytes: 3,
    refusedSends: 1,
  })
})

test("what subscriptions were told on a dial is heard, and the ones that got nothing are starved", () => {
  const decoding = "RpcClientDefect: Error decoding message"
  const base = { framesReceived: 0, state: "live", endedAt: undefined } as const
  let records: Array<SubscriptionLiveness> = [
    { ...base, label: "outline.keys", subscribedAt: 1, lastFrameAt: undefined, retries: 0, lastError: undefined },
    { ...base, label: "preferences", subscribedAt: 2, lastFrameAt: 900, retries: 4, lastError: "old" },
  ]
  const { diary, advance, said } = setup(() => records)
  const { fake, socket } = dial(diary)
  fake.open()
  socket.close(1000)
  // Told during the settle: two retries on one, none new on the other.
  records = [{ ...records[0]!, retries: 2, lastError: decoding }, records[1]!]
  advance(SETTLE_MS)
  expect(said("Dropped")[0]!.event).toMatchObject({
    cause: "severed",
    heard: [{ text: decoding, count: 2 }],
    starved: ["outline.keys", "preferences"],
    starvedMore: 0,
  })
})

test("a frame over the cap names the drop", () => {
  const { diary, advance, said } = setup()
  const { fake, socket } = dial(diary)
  fake.open()
  fake.frame("x".repeat(RPC_MAX_FRAME_BYTES + 1))
  socket.close(1000)
  advance(SETTLE_MS)
  expect(said("Dropped")[0]!.event).toMatchObject({ cause: "frame-over-cap", largestIn: RPC_MAX_FRAME_BYTES + 1 })
})

test("a close the peer made is the peer's, and the next open is a recovery", () => {
  const { diary, advance, said } = setup()
  const first = dial(diary)
  first.fake.open()
  first.fake.closed(1006)
  advance(SETTLE_MS)
  expect(said("Dropped")[0]!.event).toMatchObject({ cause: "peer-closed", code: 1006, clean: false })
  const second = dial(diary)
  second.fake.open()
  expect(said("Opened")[1]!.event.recovered).toBe(true)
})

test("a close olai declared is said as such, and the next open is no recovery", () => {
  const { diary, advance, said } = setup()
  const first = dial(diary)
  first.fake.open()
  const release = diary.declare("redial")
  first.socket.close(1000)
  release()
  const second = dial(diary)
  second.fake.open()
  advance(SETTLE_MS)
  expect(said("Dropped")[0]!.event.cause).toBe("redial")
  expect(said("Opened")[1]!.event.recovered).toBe(false)
})

test("the heartbeat's verdict names the drop it causes", () => {
  const { diary, advance, said } = setup()
  const { fake, socket } = dial(diary)
  fake.open()
  advance(25_000)
  socket.close(1000)
  diary.stale()
  advance(SETTLE_MS)
  expect(said("Stale")[0]!.event).toEqual({ _tag: "Stale", silent: 25_000, hidden: false })
  expect(said("Dropped")[0]!.event.cause).toBe("half-open")
})

test("a streak counts short dials that dropped the same way, and starts again after a long one", () => {
  const { diary, advance, said } = setup()
  const drop = (lived: number) => {
    const { fake } = dial(diary)
    fake.open()
    advance(lived)
    fake.closed(1006)
    advance(SETTLE_MS)
  }
  for (let n = 0; n < 4; n += 1) drop(1_000)
  drop(61_000)
  expect(said("Dropped").map((entry) => entry.streak)).toEqual([1, 2, 3, 4, 1])
  // Each open carries the streak before it, so a loop's opens quiet with its drops.
  expect(said("Opened").map((entry) => entry.streak)).toEqual([0, 1, 2, 3, 4])
})

test("dials that never open are said for the first, then once per thirty seconds with the count", () => {
  const { diary, advance, said } = setup()
  const fail = () => dial(diary).fake.closed(1006)
  fail()
  advance(5_000)
  fail()
  advance(5_000)
  fail()
  expect(said("Unopened").map((entry) => entry.event.attempts)).toEqual([1])
  advance(SAY_AGAIN_AFTER_MS - 10_000)
  fail()
  expect(said("Unopened").map((entry) => entry.event.attempts)).toEqual([1, 3])
  fail()
  // The dial that finally opens says the run still unsaid, and the next failure is a first again.
  dial(diary).fake.open()
  expect(said("Unopened").map((entry) => entry.event.attempts)).toEqual([1, 3, 1])
  advance(1_000)
  fail()
  expect(said("Unopened").map((entry) => entry.event.attempts)).toEqual([1, 3, 1, 1])
})

test("a declaration covers only the sockets standing when it was made", () => {
  const { diary, advance, said } = setup()
  const old = dial(diary)
  old.fake.open()
  const release = diary.declare("redial")
  // kolu dials the new socket inside the redial, before it lets the old one go,
  // and here the page closes the NEW one for a reason of its own.
  const fresh = dial(diary)
  fresh.fake.open()
  fresh.socket.close(1000)
  old.socket.close(1000)
  release()
  advance(SETTLE_MS)
  expect(said("Dropped").map((entry) => [entry.dial, entry.event.cause])).toEqual([[2, "severed"], [1, "redial"]])
})

test("a page shown again from the back-and-forward cache does not say its new sockets went with it", () => {
  const { diary, advance, said } = setup()
  dial(diary).fake.open()
  diary.unload()
  diary.shown()
  const back = dial(diary)
  back.fake.open()
  back.socket.close(1000)
  advance(SETTLE_MS)
  expect(said("Dropped").map((entry) => [entry.dial, entry.event.cause])).toEqual([[1, "unload"], [2, "severed"]])
})

test("the page going away says every standing socket at once", () => {
  const { diary, said, timers } = setup()
  const open = dial(diary)
  open.fake.open()
  const closing = dial(diary)
  closing.fake.open()
  closing.fake.closed(1006)
  diary.unload()
  expect(said("Dropped").map((entry) => [entry.dial, entry.event.cause])).toEqual([[1, "unload"], [2, "peer-closed"]])
  expect(timers.every((timer) => !timer.live)).toBe(true)
})
