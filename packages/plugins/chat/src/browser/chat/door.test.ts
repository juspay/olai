import { describe, expect, test } from "bun:test"

import { type Door, doorOf } from "./door.ts"
import { sentAgent } from "../../outings.testlib.ts"
import { toolRow as row } from "./rows.testlib.ts"

const NONE: Door = { kind: "none" }
const door = (label: string): Door => ({ kind: "door", label })

describe("which rows have a door at all", () => {
  test("a row that sent nobody has none, whatever the count says", () => {
    expect(doorOf(row({ status: "completed" }), 0)).toEqual(NONE)
    expect(doorOf(row({ status: "completed" }), 4)).toEqual(NONE)
    expect(doorOf(row({ parent: "tool:agent-1", status: "in_progress" }), 3)).toEqual(NONE)
  })

  test("a row that has not arrived yet has none either", () => {
    expect(doorOf(undefined, 3)).toEqual(NONE)
  })
})

describe("what the door says", () => {
  test("an agent that has called nothing yet is a rail, not a door", () => {
    expect(doorOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "pending" }), 0)).toEqual(NONE)
    expect(doorOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "in_progress" }), 0))
      .toEqual(NONE)
    expect(doorOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "completed" }), 0))
      .toEqual(NONE)
  })

  test("one call is `1 call`, and never `1 calls`", () => {
    expect(doorOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "completed" }), 1))
      .toEqual(door("1 call"))
  })

  test("more than one counts them", () => {
    expect(doorOf(row({ spawned: sentAgent() }), 7)).toEqual(door("7 calls"))
    expect(doorOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "in_progress" }), 2))
      .toEqual(door("2 calls"))
  })
})

describe("which agent the door opens onto", () => {
  test("a fan-out's doors say what each agent was sent to do", () => {
    expect(
      doorOf(row({ text: "Task", spawned: sentAgent({ said: "count the markdown files" }) }), 3),
    ).toEqual(door("count the markdown files · 3 calls"))
  })

  test("... and say nothing extra when the row already says it", () => {
    expect(
      doorOf(row({ text: "explore the outline", spawned: sentAgent({ said: "explore the outline" }) }), 3),
    ).toEqual(door("3 calls"))
    expect(doorOf(row({ text: "Task", spawned: sentAgent() }), 3)).toEqual(door("3 calls"))
  })
})
