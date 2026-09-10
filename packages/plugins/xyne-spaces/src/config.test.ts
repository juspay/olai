/**
 * Spaces' channel policy consumes seating answers, not chat's storage grammar.
 * These nodes carry only channel properties; the service's answers are explicit
 * so changing how chat persists a seat cannot change what this test is asking.
 * Chat's declaration fold is covered in its own tests, and the real provider's
 * arrival and withdrawal are covered by cross_plugin_doors.feature.
 */
import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { bindOf, DEFAULT_TRIM, spacesConfigIn, type Seats } from "./config.ts"

const seat = (id: string, session: string | null = "s-1"): Seats[number] => ({
  id, file: "board.olai", title: id, engine: "claude", session,
})

const reading = (channels: Record<string, string>, seats: Seats) => {
  const board = Object.entries(channels).map(([id, channel]) => JSON.stringify({
    id, ord: "a0", title: id, custom: { "xyne-channel": channel },
  })).join("\n")
  return spacesConfigIn(readingOf(setOf({ "board.olai": board })).derived, seats)
}

test("a seated conversation with a channel is bound", () => {
  const got = reading({ orch: "ch-team" }, [seat("orch")])
  expect(got.binds).toEqual([{
    node: "orch", file: "board.olai", title: "orch", channel: "ch-team",
    engine: "claude", session: "s-1",
  }])
  expect(bindOf(got, "claude", "s-1")?.channel).toBe("ch-team")
  expect(bindOf(got, "claude", "other")).toBeUndefined()
  expect(got.trim).toBe(DEFAULT_TRIM)
})

test("a seat without a session is named intent and posts nothing", () => {
  const got = reading({ orch: "ch-team" }, [seat("orch", null)])
  expect(got.named).toEqual([{ node: "orch", file: "board.olai" }])
  expect(got.binds).toEqual([])
})

test("a channel without a seat is ignored", () => {
  const got = reading({ note: "ch-team" }, [])
  expect(got.named).toEqual([])
  expect(got.binds).toEqual([])
})

test("a seat without a channel is not bound", () => {
  const got = reading({}, [seat("orch")])
  expect(got.binds).toEqual([])
  expect(bindOf(got, "claude", "s-1")).toBeUndefined()
})

test("the first channel-bearing seat wins for one conversation", () => {
  const got = reading({ a: "ch-a", b: "ch-b" }, [seat("a"), seat("b")])
  expect(got.binds.map((bind) => bind.channel)).toEqual(["ch-a"])
})

test("channel-less seats do not claim a conversation and whitespace is trimmed", () => {
  const got = reading({ a: "  ", b: " ch-b " }, [seat("a"), seat("b")])
  expect(got.binds.map((bind) => bind.channel)).toEqual(["ch-b"])
})
