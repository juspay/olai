import { expect, test } from "bun:test"
import { createDiary } from "./diary.ts"
import { relayDiary } from "./relay.ts"
import { tappedSocket } from "./socket.ts"

/** A diary and its relay on hand-moved timers, posting to a server whose
 *  answer the test picks. */
const setup = (answer: () => number) => {
  const timers: Array<{ run: () => void; live: boolean }> = []
  const set = (run: () => void) => {
    const timer = { run, live: true }
    timers.push(timer)
    return () => { timer.live = false }
  }
  const diary = createDiary({
    tab: "0123456789abcdef",
    now: () => 1_000_000,
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
      return answer()
    },
    beacon: (body) => beacons.push(body),
    timers: { set },
  })
  const fire = async () => {
    for (const timer of timers.splice(0)) if (timer.live) timer.run()
    await Promise.resolve()
    await Promise.resolve()
  }
  const socket = () => {
    const fake = Object.assign(new EventTarget(), { readyState: 0, send: () => {}, close: () => {} })
    tappedSocket(fake as unknown as WebSocket, diary.dialled())
    return {
      open: () => fake.dispatchEvent(new Event("open")),
      closed: (code: number) => fake.dispatchEvent(Object.assign(new Event("close"), { code, reason: "", wasClean: false })),
    }
  }
  return { diary, relay, posted, beacons, fire, socket }
}

const tags = (posted: ReadonlyArray<{ entries: ReadonlyArray<{ event: { _tag: string } }> }>) =>
  posted.flatMap((batch) => batch.entries.map((entry) => entry.event._tag))

test("nothing is posted while no socket is open, and the next open sends it all at once", async () => {
  const { posted, fire, socket } = setup(() => 204)
  const first = socket()
  first.closed(1006)
  await fire()
  expect(posted).toEqual([])
  socket().open()
  await Promise.resolve()
  expect(tags(posted)).toEqual(["Dialling", "Unopened", "Dialling", "Opened"])
})

test("entries leave only on a 2xx, a burst is one post, and a 404 stops the relay", async () => {
  let status = 500
  const { diary, posted, fire, socket } = setup(() => status)
  socket().open()
  await Promise.resolve()
  expect(diary.pending().entries).toHaveLength(2)
  status = 204
  diary.say({ _tag: "Roster", restarting: [] })
  diary.say({ _tag: "Roster", restarting: [] })
  await fire()
  expect(posted).toHaveLength(2)
  expect(diary.pending().entries).toHaveLength(0)
  status = 404
  diary.say({ _tag: "Roster", restarting: [] })
  await fire()
  diary.say({ _tag: "Roster", restarting: [] })
  await fire()
  expect(posted).toHaveLength(3)
})

test("a retirement is posted although no socket will open again", async () => {
  const { diary, posted, fire, socket } = setup(() => 204)
  const dial = socket()
  dial.open()
  await Promise.resolve()
  dial.closed(4001)
  diary.retired()
  await fire()
  expect(tags(posted)).toContain("Retired")
})

test("on the way out the rest goes in one beacon, only when the server was answering", () => {
  const { relay, beacons, diary } = setup(() => 204)
  diary.say({ _tag: "Roster", restarting: [] })
  relay.leaving(false)
  expect(beacons).toEqual([])
  relay.leaving(true)
  expect(beacons).toHaveLength(1)
})
