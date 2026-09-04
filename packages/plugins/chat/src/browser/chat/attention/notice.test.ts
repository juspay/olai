import { expect, test } from "bun:test"

import { noticeOf, openingLine } from "./notice.ts"

const conversation = (title: string | null, id = "sess-1") => ({
  session: { id, title, updatedAt: null },
})

test("the banner names the conversation and the first line of the question", () => {
  const notice = noticeOf({ ...conversation("kitchen remodel"), asking: 1 }, {
    id: "ask:3",
    text: "Which timber for the doors?\n\nOak is in stock; birch is two weeks out.",
  })
  expect(notice.title).toBe("kitchen remodel")
  expect(notice.body).toBe("Which timber for the doors?")
})

test("a conversation the agent has not named yet says the app's own word", () => {
  // Since the deployment names itself after its box (`app.get`), THAT is the
  // word an unanswered conversation goes by — the one the OS is already
  // labelling an installed banner with — and bare "olai" is the fallback
  // before the server has said it.
  const waiting = { ...conversation(null), asking: 1 }
  expect(noticeOf(waiting, undefined, "olai [desk]").title).toBe("olai [desk]")
})

test("...and says the bare word until the deployment has said its own", () => {
  const notice = noticeOf({ ...conversation(null), asking: 1 }, undefined)
  expect(notice.title).toBe("olai")
})

test("with the panel shut and no question in hand, it says the plain fact", () => {
  // The panel keeps no transcript subscription while minimized (`../last.ts`),
  // so there are no words to quote — and a question remembered from the last
  // time it was open would be a banner about something else.
  const notice = noticeOf({ ...conversation("kitchen remodel"), asking: 1 }, undefined)
  expect(notice.body).toBe("is waiting on your answer")
})

test("the others waiting are counted, question or no question", () => {
  expect(
    noticeOf({ ...conversation("kitchen"), asking: 3 }, { id: "a", text: "Which timber?" })
      .body,
  ).toBe("Which timber? (and 2 more)")
  expect(noticeOf({ ...conversation("kitchen"), asking: 2 }, undefined).body).toBe(
    "is waiting on your answer (and 1 more)",
  )
})

test("the tag is the conversation's, so two tabs raise one banner", () => {
  const one = noticeOf({ ...conversation("kitchen"), asking: 1 }, { id: "ask:1", text: "a" })
  const two = noticeOf({ ...conversation("kitchen"), asking: 2 }, { id: "ask:2", text: "b" })
  expect(one.tag).toBe(two.tag)
  expect(one.tag).toContain("sess-1")
})

test("a press asks for the conversation, not a row that may be gone by then", () => {
  // What is waiting is something the PANEL knows when the press lands. A row
  // id from the moment the banner went up can be answered in another tab, and
  // a banner raised over a shut panel never named one at all.
  const named = noticeOf({ ...conversation("kitchen"), asking: 1 }, {
    id: "ask:3",
    text: "Which timber?",
  })
  const blind = noticeOf({ ...conversation("kitchen"), asking: 1 }, undefined)
  expect(named.data).toEqual({ kind: "ask" })
  expect(blind.data).toEqual(named.data)
})

// ── the first line ──────────────────────────────────────────────────────

test("blank lines above the question are skipped", () => {
  expect(openingLine("\n   \nWhich timber?\nOak or birch.")).toBe("Which timber?")
})

test("a question with no words at all has no line", () => {
  expect(openingLine("   \n\n  ")).toBeUndefined()
})

test("a very long first line is clamped rather than left to the OS", () => {
  const line = openingLine("x".repeat(400))
  expect(line?.length).toBe(140)
  expect(line?.endsWith("…")).toBe(true)
})
