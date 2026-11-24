import { expect, test } from "bun:test"
import { createDiary } from "./diary.ts"
import { POST_AFTER_MS, relayDiary, RETRY_EVERY_MS } from "./relay.ts"
import { tappedSocket } from "./socket.ts"

/** A diary and its relay on hand-moved timers, posting to a server whose
 *  answer the test picks. */
const setup = (answer: () => number | Error | Promise<number>) => {
  let clock = 0
  const timers: Array<{ at: number; run: () => void; live: boolean }> = []
  const set = (run: () => void, ms: number) => {
    const timer = { at: clock + ms, run, live: true }
    timers.push(timer)
    return () => { timer.live = false }
  }
  const diary = createDiary({
    tab: "0123456789abcdef",
    now: () => 1_000_000 + clock,
    online: () => true,
    hidden: () => false,
    liveness: () => [],
    timers: { set },
    print: () => {},
  })
  const posted: Array<{ entries: Array<{ event: { _tag: string } }> }> = []
  const beacons: Array<string> = []
  const relay = relayDiary({
    diary,
    post: async (body) => {
      posted.push(JSON.parse(body))
      const said = answer()
      if (said instanceof Error) throw said
      return await said
    },
    beacon: (body) => beacons.push(body),
    timers: { set },
  })
  /** Move the clock and run what fell due, letting each post settle. */
  const advance = async (ms: number) => {
    clock += ms
    for (const timer of [...timers]) {
      if (timer.live && timer.at <= clock) {
        timer.live = false
        timer.run()
      }
    }
    for (let turn = 0; turn < 4; turn += 1) await Promise.resolve()
  }
  const socket = () => {
    const fake = Object.assign(new EventTarget(), { readyState: 0, send: () => {}, close: () => {} })
    tappedSocket(fake as unknown as WebSocket, diary.dialled())
    return {
      open: () => fake.dispatchEvent(new Event("open")),
      closed: (code: number) => fake.dispatchEvent(Object.assign(new Event("close"), { code, reason: "", wasClean: false })),
    }
  }
  return { diary, relay, posted, beacons, advance, socket }
}

const tags = (posted: ReadonlyArray<{ entries: ReadonlyArray<{ event: { _tag: string } }> }>) =>
  posted.flatMap((batch) => batch.entries.map((entry) => entry.event._tag))

test("a dial that never opens is posted all the same, a second later", async () => {
  const { posted, advance, socket } = setup(() => 204)
  socket().closed(1006)
  await advance(POST_AFTER_MS)
  expect(tags(posted)).toEqual(["Dialling", "Unopened"])
})

test("an open is posted at once", async () => {
  const { posted, socket } = setup(() => 204)
  socket().open()
  await Promise.resolve()
  expect(tags(posted)).toEqual(["Dialling", "Opened"])
})

test("an entry said while a post is in flight is posted when that post is taken", async () => {
  const slow = Promise.withResolvers<number>()
  const answers: Array<Promise<number> | number> = [slow.promise]
  const { diary, posted, advance, socket } = setup(() => answers.shift() ?? 204)
  socket().open()
  expect(posted).toHaveLength(1)
  // Said while the first post is still on its way; its own post, a second
  // later, finds that one still going.
  diary.say({ _tag: "Roster", restarting: [] })
  await advance(1_000)
  expect(posted).toHaveLength(1)
  slow.resolve(204)
  await advance(0)
  expect(tags(posted)).toEqual(["Dialling", "Opened", "Roster"])
  expect(diary.pending().entries).toHaveLength(0)
})

test("a post the server did not take is tried again on the cadence until one is, and entries leave only then", async () => {
  const answers: Array<number | Error> = [new TypeError("Failed to fetch"), 503, 204]
  const { diary, posted, advance, socket } = setup(() => answers.shift() ?? 204)
  socket().closed(1006)
  await advance(POST_AFTER_MS)
  expect(posted).toHaveLength(1)
  expect(diary.pending().entries).toHaveLength(2)
  await advance(RETRY_EVERY_MS)
  expect(posted).toHaveLength(2)
  expect(diary.pending().entries).toHaveLength(2)
  await advance(RETRY_EVERY_MS)
  expect(posted).toHaveLength(3)
  expect(diary.pending().entries).toHaveLength(0)
  await advance(RETRY_EVERY_MS)
  expect(posted).toHaveLength(3)
})

test("a 404 stops the relay, retries and beacon included", async () => {
  const { diary, relay, posted, beacons, advance } = setup(() => 404)
  diary.say({ _tag: "Roster", restarting: [] })
  await advance(POST_AFTER_MS)
  expect(posted).toHaveLength(1)
  diary.say({ _tag: "Roster", restarting: [] })
  await advance(RETRY_EVERY_MS)
  relay.leaving()
  expect(posted).toHaveLength(1)
  expect(beacons).toEqual([])
})

test("on the way out whatever is left goes in one beacon", () => {
  const { relay, beacons, diary } = setup(() => 204)
  relay.leaving()
  expect(beacons).toEqual([])
  diary.say({ _tag: "Roster", restarting: [] })
  relay.leaving()
  expect(beacons).toHaveLength(1)
})
