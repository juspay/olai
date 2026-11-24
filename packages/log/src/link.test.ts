import { expect, test } from "bun:test"
import { type LogLevel, Schema } from "effect"
import { Batch, type Cause, closeMeans, describe, type Entry, type LinkEvent, loudAt, nextStreak, stamped, stampOf } from "./link.ts"

const dropped = (cause: Cause): LinkEvent => ({
  _tag: "Dropped",
  cause,
  code: 1000,
  clean: true,
  lived: 1900,
  silent: 40,
  inFrames: 12,
  inBytes: 3400,
  largestIn: 900,
  outFrames: 8,
  outBytes: 1200,
  refusedSends: 0,
  heard: [{ text: "RpcClientDefect: Error decoding message", count: 3 }],
  starved: ["outline.keys"],
  starvedMore: 2,
  hidden: false,
  online: true,
})

const entry = (event: LinkEvent, streak = 0, dial = 2): Entry => ({ seq: 7, at: 1_700_000_000_000, dial, streak, event })

const table: ReadonlyArray<readonly [string, Entry, LogLevel.LogLevel, string]> = [
  ["a dial", entry({ _tag: "Dialling" }), "Debug", "wire dialling"],
  ["a first open", entry({ _tag: "Opened", took: 30, recovered: false }), "Debug", "wire opened"],
  ["an open after a drop", entry({ _tag: "Opened", took: 30, recovered: true }, 1), "Info", "wire opened"],
  ["an open deep in a loop", entry({ _tag: "Opened", took: 30, recovered: true }, 5), "Debug", "wire opened"],
  ["a peer's close", entry(dropped("peer-closed"), 1), "Warn", "wire dropped"],
  ["a severed socket", entry(dropped("severed"), 1), "Warn", "wire dropped"],
  ["a frame over the cap", entry(dropped("frame-over-cap"), 1), "Warn", "wire dropped"],
  ["a half-open wire", entry(dropped("half-open"), 1), "Warn", "wire dropped"],
  ["olai's redial", entry(dropped("redial"), 1), "Debug", "wire dropped"],
  ["olai's roster refresh", entry(dropped("roster-refresh"), 1), "Debug", "wire dropped"],
  ["the page going away", entry(dropped("unload"), 1), "Debug", "wire dropped"],
  ["a drop deep in a loop", entry(dropped("peer-closed"), 4), "Debug", "wire dropped"],
  ["a tenth drop in a loop", entry(dropped("peer-closed"), 10), "Warn", "wire dropped"],
  ["a dial that did not open", entry({ _tag: "Unopened", took: 20, code: 1006, attempts: 3, online: true }), "Warn", "dial did not open"],
  ["the heartbeat", entry({ _tag: "Stale", silent: 25_000, hidden: false }), "Warn", "heartbeat gave up"],
  ["a retirement", entry({ _tag: "Retired", code: 4001 }), "Warn", "wire retired"],
  ["the card up", entry({ _tag: "Card", shown: true, status: "reconnecting", urged: false }), "Info", "connection-lost card shown"],
  ["the card down", entry({ _tag: "Card", shown: false, status: "live", urged: false, after: 4200 }), "Info", "connection-lost card lifted"],
  ["into degraded", entry({ _tag: "Readout", from: "live", to: "degraded", stopped: ["olai/plugins"] }), "Warn", "readout changed"],
  ["out of degraded", entry({ _tag: "Readout", from: "degraded", to: "live", stopped: [] }), "Info", "readout changed"],
  ["into reconnecting", entry({ _tag: "Readout", from: "live", to: "reconnecting", stopped: [] }), "Debug", "readout changed"],
  ["a roster redial", entry({ _tag: "Roster", restarting: ["chat"] }), "Debug", "roster redial"],
  ["a refused roster", entry({ _tag: "RosterRefused", why: "chunk failed" }), "Error", "roster redial refused"],
  ["an unreadable bootstrap", entry({ _tag: "BootFailed", why: "timed out" }), "Warn", "browser bootstrap could not be read"],
]

test.each(table)("%s reads at its level, in its sentence", (_, given, level, message) => {
  const read = describe(given)
  expect(read.level).toBe(level)
  expect(read.message).toBe(message)
})

test("a drop says who closed it, what the code means, and what was heard", () => {
  const { fields } = describe(entry(dropped("severed"), 2))
  expect(fields).toMatchObject({
    cause: "severed",
    by: "page",
    code: 1000,
    means: "normal",
    lived: "1.9s",
    heard: "RpcClientDefect: Error decoding message ×3",
    starved: "outline.keys +2",
    streak: 2,
  })
  expect(describe(entry(dropped("peer-closed"), 1)).fields.by).toBe("peer")
})

test("a streak is loud for its first three and every tenth", () => {
  expect([1, 3, 4, 10].map(loudAt)).toEqual([true, true, false, true])
})

test("a streak continues only for short dials that dropped the same way", () => {
  const last = { cause: "peer-closed", streak: 3, lived: 1000 } as const
  expect(nextStreak(undefined, { cause: "peer-closed", lived: 1000 })).toBe(1)
  expect(nextStreak(last, { cause: "peer-closed", lived: 1000 })).toBe(4)
  expect(nextStreak(last, { cause: "severed", lived: 1000 })).toBe(1)
  expect(nextStreak(last, { cause: "peer-closed", lived: 60_000 })).toBe(1)
})

test("close codes say what they mean", () => {
  expect([1000, 1006, 1009, 4001, 3999].map(closeMeans)).toEqual(["normal", "abnormal", "too big", "stale process", "unlisted"])
})

test("a batch survives a round trip through JSON", () => {
  const batch = { tab: "0123456789abcdef", entries: table.map(([, one]) => one), lost: 2 }
  const codec = Schema.fromJsonString(Batch)
  const back = Schema.decodeUnknownSync(codec)(Schema.encodeSync(codec)(batch))
  expect(back).toEqual(batch)
})

test("a batch with a malformed tab is refused", () => {
  expect(() => Schema.decodeUnknownSync(Batch)({ tab: "../../etc", entries: [], lost: 0 })).toThrow()
})

test("a socket URL names its tab and dial only when they have the shape a tab mints", () => {
  expect(stampOf(new URL("ws://h/ws?tab=0123456789abcdef&dial=3"))).toEqual({ tab: "0123456789abcdef", dial: 3 })
  expect(stampOf(new URL("ws://h/ws?tab=evil%20value&dial=-1"))).toEqual({})
  expect(stampOf(new URL("ws://h/ws"))).toEqual({})
})

test("a stamped URL gives its stamp back and keeps the query it had", () => {
  const stamp = { tab: "0123456789abcdef", dial: 4 }
  const url = new URL(stamped("ws://h/rpc/ws?pid=abc", stamp))
  expect(stampOf(url)).toEqual(stamp)
  expect(url.href).toBe("ws://h/rpc/ws?pid=abc&tab=0123456789abcdef&dial=4")
})
