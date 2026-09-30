import { expect, test } from "bun:test"
import { Transcript } from "./transcript.ts"

test("rewind points use the immediately preceding answer, never an earlier turn", () => {
  const transcript = new Transcript()
  const first = transcript.user("first").key
  expect(transcript.forkPoint(first)).toBeNull()
  transcript.say("answer", "a1")
  transcript.settle()
  const second = transcript.user("second").key
  expect(transcript.forkPoint(second)).toBe("a1")
  const third = transcript.user("queued or unanswered").key
  expect(transcript.forkPoint(third)).toBeUndefined()
  transcript.say("answer without an identity", "   ")
  transcript.settle()
  expect(transcript.forkPoint(transcript.user("no cutoff").key)).toBeUndefined()
})

test("replay keeps message boundaries and the final agent message's identity", () => {
  const transcript = new Transcript()
  transcript.userSaid("first", "u1")
  transcript.userSaid(" part", "u1")
  transcript.say("thinking", "a1")
  transcript.say("answer", "a2")
  transcript.say(" done", "a2")
  transcript.userSaid("second", "u2")
  const rows = [...transcript.entries().values()]
  expect(rows.map(row => row.text)).toEqual(["first part", "thinking", "answer done", "second"])
  expect(transcript.forkPoint(rows[3]!.id)).toBe("a2")
  expect(JSON.stringify(rows)).not.toContain('"a2"')
  transcript.clear()
  expect(transcript.forkPoint(rows[3]!.id)).toBeUndefined()
  expect(transcript.forkPoint(transcript.user("fresh").key)).toBeNull()
})
