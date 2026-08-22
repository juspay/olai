/**
 * Which of the panel's four bodies a state asks for, over values.
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
})

/**
 * WHERE TWO OF THEM COULD CLAIM AT ONCE.
 *
 * Its own block because these are the cases the three above cannot state: each
 * of them moves one field and leaves the other at its ordinary value, so none
 * of them can say which answer WINS. The cell is a value that arrives over a
 * wire, and every one of these is constructible.
 */
describe("two faces claiming one body", () => {
  test("no agent wins over a refusal", () => {
    // Unreachable in practice — nothing was attempted, so nothing was refused —
    // and stated anyway, because a precedence nobody wrote down is one a reader
    // meeting the two fields in the other order can get backwards.
    expect(faceOf({ ...CHAT_OFF, unopened: REFUSED })).toEqual({ kind: "no-agent" })
  })

  test("an agent that has GONE wins over a refusal it left behind", () => {
    // Reachable, and the reason this block exists: refuse an open, then have
    // the agent die — a spawn that fails on the retry sets `gone` from the verb
    // that failed rather than from the process going, so no exit event fires to
    // clear what was recorded before it. The face would then say "the agent
    // itself is running — it answered" under a header saying it is not there.
    //
    // The rows a dead agent left are the body, deliberately, with `trouble`
    // under them saying what happened.
    expect(faceOf({ ...LIVE, status: "gone", trouble: "the agent exited", unopened: REFUSED }))
      .toEqual({ kind: "conversation" })
  })

  test("a refusal being RETRIED keeps its face while the retry is in flight", () => {
    // The one overlap that goes the other way, and the difference is that
    // nothing has changed yet: `booting` with a refusal on it is a person who
    // has just pressed *try again*, and what they are owed is the thing they
    // pressed still saying what it was about. A body swapped out here would
    // flash the empty conversation and come back.
    expect(faceOf({ ...LIVE, status: "booting", unopened: REFUSED }))
      .toEqual({ kind: "unopened", unopened: REFUSED })
  })

  test("...where a panel merely STARTING is the conversation", () => {
    // The same status, the other value, and the pair is what makes the line
    // above about the refusal rather than about `booting`: the first paint of
    // every panel is this one, and it draws the conversation.
    expect(faceOf({ ...LIVE, status: "booting" })).toEqual({ kind: "conversation" })
  })
})

describe("the question about which agent", () => {
  /** Two agents and nobody has said which. The server only ever sets this with
   *  no conversation open. */
  const ASKING: ChatState = { ...LIVE, choosing: true }

  test("is the body when the panel is asking", () => {
    expect(faceOf(ASKING)).toEqual({ kind: "choose" })
  })

  test("and not when nobody is asking, which is nearly every panel", () => {
    expect(faceOf(LIVE)).toEqual({ kind: "conversation" })
  })

  test("no agent at all outranks it — nothing was asked", () => {
    // `choosing` cannot be true with an empty roster (there is no chat at all),
    // and a precedence stated only in the writer is one a reader can meet in
    // the other order.
    expect(faceOf({ ...CHAT_OFF, choosing: true })).toEqual({ kind: "no-agent" })
  })

  test("a refusal outranks it — that one is about a live agent", () => {
    // The agent answered and said no, which is a sentence with a retry under
    // it. Asking which agent over the top of that would take the reason away.
    expect(faceOf({ ...ASKING, unopened: REFUSED })).toEqual({
      kind: "unopened",
      unopened: REFUSED,
    })
  })

  test("a dead agent does not take the question away", () => {
    // Unlike a refusal, which is ABOUT a live agent and must not outlive it:
    // `choosing` says there is no conversation, so there are no rows a dead
    // agent left to read and an empty transcript is not what anybody is owed.
    // The server never sets the pair — it binds an agent before one can die —
    // and a precedence stated only in the writer is one a reader can meet in
    // the other order.
    expect(faceOf({ ...ASKING, status: "gone" })).toEqual({ kind: "choose" })
  })
})
