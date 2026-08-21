/**
 * Which of the panel's three bodies a state asks for, over values.
 *
 * The rule is a precedence between two facts that arrive on one cell, and every
 * way of getting it wrong is a person looking at the wrong explanation of why
 * there is no conversation in front of them. Reaching that through a browser
 * means starting a server and an agent and talking one of them into saying no,
 * which is not how anybody should have to check that a face does not outlive
 * its cause.
 */

import { CHAT_OFF, type ChatState } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { faceOf } from "./face.ts"

/** A live panel, as the cell holds one. `CHAT_OFF` is the no-agent value, so
 *  the ordinary case is spelled once here rather than at every test. */
const LIVE: ChatState = { ...CHAT_OFF, status: "idle" }

const REFUSED = { why: "no such conversation: fake-stored-old", what: "fake-stored-old" }

describe("which body the panel draws", () => {
  test("a conversation, which is nearly every panel", () => {
    expect(faceOf(LIVE)).toEqual({ kind: "conversation" })
  })

  test("no agent configured is the explanation, not an empty conversation", () => {
    // The panel DRAWS in this state rather than disappearing, which is the
    // argument every one of these faces inherits: a capability that is silently
    // absent cannot be told apart from one that is broken.
    expect(faceOf(CHAT_OFF)).toEqual({ kind: "no-agent" })
  })

  test("an agent that would not open one is its own face, with the reason on it", () => {
    // The reason travels WITH the choice rather than being fetched again at the
    // point it is drawn: two reads of one fact are two answers free to
    // disagree, and this is the one that can be `null`.
    expect(faceOf({ ...LIVE, unopened: REFUSED })).toEqual({
      kind: "unopened",
      unopened: REFUSED,
    })
  })

  test("...and it is not a fact about a dead agent", () => {
    // The whole distinction. `gone` is a process that is not there; this is one
    // that answered. A panel that folded them together said `not running` about
    // an agent that had just spoken to it.
    expect(faceOf({ ...LIVE, status: "gone", trouble: "the agent exited" }))
      .toEqual({ kind: "conversation" })
  })

  test("a refusal does not outlive the conversation that answers it", () => {
    // The clearing rule, from the other side: the cell carries `null` the
    // moment one is open, so nothing here has to decide when a face has stopped
    // being true.
    expect(faceOf({ ...LIVE, unopened: null })).toEqual({ kind: "conversation" })
  })

  test("no agent wins over a refusal, whatever order they are met in", () => {
    // Unreachable in practice — nothing was attempted, so nothing was refused —
    // and stated anyway, because the cell is a value that arrives over a wire
    // and a precedence nobody wrote down is one a reader can get backwards.
    expect(faceOf({ ...CHAT_OFF, unopened: REFUSED })).toEqual({ kind: "no-agent" })
  })

  test("a panel still booting is the conversation, not an explanation", () => {
    // A body swapped out while the agent starts would flash an explanation at
    // somebody every time they opened the drawer. The refused face is a state
    // that has SETTLED.
    expect(faceOf({ ...LIVE, status: "booting" })).toEqual({ kind: "conversation" })
  })
})
