/**
 * What a call that sent an agent out says for itself.
 *
 * No DOM: two functions over one row, and the question they answer is the one
 * the panel had no answer to — an agent has been sent out and has reported
 * NOTHING, so there is no lane, no rail and no name anywhere, and most of what
 * is claimed below is about that stretch rather than about the tidy one after
 * it. The exception is the last block, which is about the stretch after the
 * WRONG end: an agent that died in the middle of one.
 */

import { describe, expect, test } from "bun:test"

import { toolRow as row } from "./rows.testlib.ts"
import { doingOf, sentOf, whoOf } from "./spawn.ts"

describe("which rows sent somebody", () => {
  test("a call that spawned nobody has no face at all", () => {
    expect(whoOf(row({ status: "in_progress" }))).toBeNull()
    expect(doingOf(row({ status: "in_progress" }))).toBeNull()
    // ... including a call a subagent MADE, which is the other end of this
    // feature and not this one: it is drawn in a lane, and a face on it would
    // claim the subagent had spawned an agent of its own.
    expect(whoOf(row({ parent: "tool:agent-1", status: "in_progress" }))).toBeNull()
  })

  test("a row that has not arrived yet has none either", () => {
    // The transient the list has: a key is in `rows()` and its value is a
    // frame behind. Asked about nothing, the answer is nothing.
    expect(whoOf(undefined)).toBeNull()
    expect(doingOf(undefined)).toBeNull()
  })
})

describe("who was sent", () => {
  test("the kind of agent, in the agent's own word", () => {
    expect(whoOf(row({ spawned: { kind: "Explore" } }))).toBe("Explore")
    // Not rounded to anything this panel has heard of — a name nobody here
    // knows is still the name somebody started.
    expect(whoOf(row({ spawned: { kind: "roadmap-auditor" } }))).toBe("roadmap-auditor")
  })

  test("a spawn that named no kind still says somebody was sent", () => {
    // Naming a kind is optional in the tool that starts an agent, so this is
    // an ordinary spawn rather than a broken one — and a row saying nothing
    // where every other spawn says something reads as a row that failed.
    expect(whoOf(row({ spawned: {} }))).toBe("agent")
  })

  test("... and goes on saying it after the agent has reported back", () => {
    // The row is the record of an agent having been sent out, which does not
    // stop being true when it comes back.
    expect(whoOf(row({ spawned: { kind: "Explore" }, status: "completed" })))
      .toBe("Explore")
  })
})

describe("whether it is still going", () => {
  test("an announced spawn is a RUNNING one, and says the same word as a beaten one", () => {
    // The adapter announces every tool call `pending` and dispatches the
    // subagent immediately, so `pending` here means "announced" rather than
    // "not started" — and the two used to say different words. The one that
    // made it wrong is the `pending` case: a heartbeat can be half a minute
    // away, so a subagent whose calls were already drawn in the lane below
    // this rail went on being described as *starting…* while they arrived.
    expect(doingOf(row({ spawned: { kind: "Explore" } }))).toBe("working…")
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "pending" })))
      .toBe("working…")
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "in_progress" })))
      .toBe("working…")
  })

  test("a spawn that has stopped has nothing live left to say", () => {
    // The half that has to come OFF: a rail still saying "working…" under a
    // finished call tells a reader a fan-out is running when the turn is over.
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "completed" })))
      .toBeNull()
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "failed" })))
      .toBeNull()
  })

  test("nor has one whose TURN has ended, whatever its own status says", () => {
    // The way this actually goes wrong, and the half a status cannot answer. A
    // status is sticky, and the rows a dead agent left are deliberately still
    // on screen to read — so an agent that died between announcing a spawn and
    // reporting on it leaves a row that says `pending` for as long as the panel
    // is open. Asked of the status alone, that is a rail pulsing "working…"
    // under a process that no longer exists.
    //
    // The server marks what its turns abandoned, so this is the ROW's answer
    // rather than a conversation-wide one — which is what makes it survive the
    // next thing anybody sends (`./running.ts`).
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "pending", stranded: true })))
      .toBeNull()
    expect(
      doingOf(row({ spawned: { kind: "Explore" }, status: "in_progress", stranded: true })),
    ).toBeNull()
    // ... and who it was is still said, because that is a fact about what
    // happened rather than about what is happening.
    expect(whoOf(row({ spawned: { kind: "Explore" }, status: "pending", stranded: true })))
      .toBe("Explore")
  })
})

/**
 * ... and WHAT IT WAS SENT TO DO, which is the question the row's own title
 * cannot answer against the adapter this panel ships with.
 *
 * Every other table in this file can be written with a spawn titled by its
 * description, because that is what the fixtures do and what the e2e fake agent
 * does. The real adapter titles an `Agent` call with the TOOL's name and the
 * title is pinned at the first frame that carries one — so a fan-out is a
 * column of rows reading `Task`. Four surfaces ask this: the strip, the shelf's
 * head, the door, and the label over a subagent's QUESTION. The last of those
 * was reading the title directly, which is the one row in the panel where being
 * wrong about who is speaking changes what somebody presses.
 */
describe("what an agent was sent to do", () => {
  test("a call that sent nobody was sent to do nothing", () => {
    expect(sentOf(row({ status: "completed" }))).toBeNull()
    // Including a call a subagent MADE, which carries a parent and no spawn.
    expect(sentOf(row({ parent: "tool:agent-1" }))).toBeNull()
    // ... and the transient the list has: a key whose value is a frame behind.
    expect(sentOf(undefined)).toBeNull()
  })

  test("a spawn answers with its description, not with the tool's name", () => {
    expect(sentOf(row({ text: "Task", spawned: { said: "read every note" } })))
      .toBe("read every note")
    // The kind is a different question and does not stand in for this one: an
    // agent's KIND is `Explore`, and four `Explore`s tell you nothing either.
    expect(sentOf(row({ text: "Task", spawned: { kind: "Explore", said: "read every note" } })))
      .toBe("read every note")
  })

  test("... and falls back to what the row is called when it described none", () => {
    // The honest fallback: it is exactly what a reader sees on that row. The
    // arguments arrive across frames, so a spawn is briefly one of these even
    // when it does end up describing itself.
    expect(sentOf(row({ text: "Task", spawned: {} }))).toBe("Task")
    expect(sentOf(row({ text: "read every note", spawned: { kind: "Explore" } })))
      .toBe("read every note")
  })
})
