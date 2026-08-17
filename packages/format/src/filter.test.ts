import { expect, test } from "bun:test"

import { derive, type Row, rowsOf } from "./derive.ts"
import {
  keeping,
  matchedIn,
  matching,
  parseFilter,
  type Refusal,
  relativeSpan,
  shownRecord,
} from "./filter.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"

/** One corpus, standing in for a directory: marks, dates, notes, edges, tags,
 *  a mirror, and an archive beside it. Every assertion below is about this. */
const CORPUS = {
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters","done":"2026-08-03"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"date":"2026-08-10","desc":"walnut or birch","after":["demo"],"see":["herbs"],"custom":{"agent":"Claude-Opus","pr":"https://github.com/juspay/olai/pull/176","tags":["cabinets","walnut"]}}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","doc":"finishes.md"}`,
    `{"id":"hinges","parent":"install","ord":"a0","title":"pick the hinges #home","todo":"2026-08-11"}`,
    `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
  ].join("\n"),
  "garden.olai": [
    `{"id":"garden","ord":"a0","title":"garden #outdoors"}`,
    `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed #home","doing":true}`,
    `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20","custom":{"agent":"claude-opus"}}`,
  ].join("\n"),
  "Archive.olai": [
    `{"id":"gone","ord":"a0","title":"the old kitchen table #home","done":"2026-06-01"}`,
  ].join("\n"),
}

const derived = derive(nodesOfFiles(CORPUS))

/** The day every query below is asked on — a THURSDAY, deliberately: a week
 *  computed from the middle of one is wrong in both directions when the
 *  arithmetic is off, where a Monday hides half the mistakes. The corpus sits
 *  around it: `order` is scheduled for Monday the 10th, `demo` was finished the
 *  Monday before that, `basil` in the month before.
 *
 *  A CONSTANT rather than a clock, which is the whole reason `parseFilter`
 *  takes the day: every one of these boundaries is right for most of the year
 *  and off by one in some particular week. */
const TODAY = "2026-08-13"

/** The ids a query selects, in the set's own order, asked on some other day —
 *  what the three day-words need, since each of them names a different one. */
const selectsOn = (text: string, today: string): ReadonlyArray<string> =>
  matching(derived, parseFilter(text, today)).map(({ at }) => at.node.id)

/** The ids a query selects, in the set's own order. */
const selects = (text: string): ReadonlyArray<string> => selectsOn(text, TODAY)

// ── the grammar ────────────────────────────────────────────────────────

// The three states a query can be in, and they are three different things to
// DO: draw the page whole, draw nothing and say why, or ask.
test("nothing typed, refused, and asking are told apart", () => {
  expect(parseFilter("", TODAY).kind).toBe("nothing")
  expect(parseFilter("   ", TODAY).kind).toBe("nothing")
  expect(parseFilter("is:done", TODAY).kind).toBe("asking")
  expect(parseFilter("is:blocked", TODAY).kind).toBe("refused")
  expect(selects("is:blocked")).toEqual([])
})

test("words are case-folded substrings, and every one must be in the same node", () => {
  expect(selects("CABINETS")).toEqual(["order", "install"])
  expect(selects("cabinets order")).toEqual(["order"])
  expect(selects("cabinets herbs")).toEqual([])
})

test("a tag is found bare and as written", () => {
  expect(selects("#home")).toEqual(["herbs", "kitchen", "hinges"])
  // Bare, so it also reaches the word wherever else it appears.
  expect(selects("home")).toEqual(["herbs", "kitchen", "hinges"])
  expect(selects("#outdoors")).toEqual(["garden"])
})

test("`is:` reads the mark the node STORES, never a derived one", () => {
  expect(selects("is:done")).toEqual(["basil", "demo"])
  expect(selects("is:doing")).toEqual(["herbs", "kitchen", "order"])
  expect(selects("is:todo")).toEqual(["hinges"])
  // `install` has a done child and no mark of its own: a bullet is not a task,
  // and a rollup is not a status.
  expect(selects("is:marked")).toEqual([
    "herbs",
    "basil",
    "kitchen",
    "demo",
    "order",
    "hinges",
  ])
})

test("`has:` asks what the record carries, and an empty edge list is no edge", () => {
  expect(selects("has:desc")).toEqual(["order"])
  expect(selects("has:doc")).toEqual(["install"])
  expect(selects("has:see")).toEqual(["order"])
  expect(selects("has:after")).toEqual(["order"])
})

// The four ways a field can hold nothing are the WRITER's list (`write.ts`'s
// `nothing`), asked as a question rather than restated — so a note the writer
// would drop from the line is not a note to search for. A second list here is
// how `desc: ""` becomes a node with a note and no note at once.
test("a field holding nothing is a field the record does not carry", () => {
  const hollow = derive(nodesOfFiles({
    "a.olai": [
      `{"id":"blank","ord":"a0","title":"blank","desc":"","see":[],"after":[]}`,
      `{"id":"real","ord":"a1","title":"real","desc":"something"}`,
    ].join("\n"),
  }))
  const ids = (text: string) =>
    matching(hollow, parseFilter(text, TODAY)).map(({ at }) => at.node.id)
  expect(ids("has:desc")).toEqual(["real"])
  expect(ids("has:see")).toEqual([])
  expect(ids("has:after")).toEqual([])
})

test("`date:` reads the two dates a journal reads — scheduled, and finished", () => {
  // `order` is scheduled for the 10th; `demo` was finished on the 3rd.
  expect(selects("date:2026-08-10")).toEqual(["order"])
  expect(selects("date:2026-08-03")).toEqual(["demo"])
  // A dated `doing` or `todo` is on no day here, exactly as a day page reads
  // it: `kitchen` carries `doing:2026-08-01` and is on no day.
  expect(selects("date:2026-08-01")).toEqual([])
  // ...and `hinges` carries `todo:2026-08-11`.
  expect(selects("date:2026-08-11")).toEqual([])
})

// `has:date` is `date:` with no bounds rather than a test of the `date` FIELD,
// so a node found by `date:2026-08-03` (a dated `done`) is also found by
// `has:date`. Two answers to one word is the thing that would be wrong.
test("`has:date` is the same walk `date:` reads, unbounded", () => {
  expect(selects("has:date")).toEqual(["basil", "demo", "order"])
  // `hinges` carries `todo:"2026-08-11"` and no `date` — a journal reads
  // neither a dated `doing` nor a dated `todo`, and neither does this.
  expect(selects("has:date")).not.toContain("hinges")
})

test("a month and a year are prefixes; a range is two comparisons", () => {
  expect(selects("date:2026-08")).toEqual(["demo", "order"])
  expect(selects("date:2026-07")).toEqual(["basil"])
  expect(selects("date:2026")).toEqual(["basil", "demo", "order"])
  expect(selects("date:2026-08-04..2026-08-20")).toEqual(["order"])
  expect(selects("date:..2026-08-03")).toEqual(["basil", "demo"])
  expect(selects("date:2026-08-04..")).toEqual(["order"])
})

// ── the relative words ─────────────────────────────────────────────────

// The RESOLUTION, on its own: a pure function of a word and a day, which is
// what makes a boundary something a test can pin rather than something that is
// true until next Monday. Every span below is inclusive at both ends.

test("a week runs Monday to Sunday, wherever in it the question is asked", () => {
  // The 13th is a Thursday; its week opens on Monday the 10th and closes on
  // Sunday the 16th. Asked from EVERY day of that week, the answer is the same
  // seven days — which is what "this week" has to mean to be worth having.
  for (const day of [
    "2026-08-10",
    "2026-08-11",
    "2026-08-12",
    "2026-08-13",
    "2026-08-14",
    "2026-08-15",
    "2026-08-16",
  ]) {
    expect(relativeSpan("this-week", day)).toEqual({
      from: "2026-08-10",
      to: "2026-08-16",
    })
  }
  // The Monday after is the next week's, not the same one's last day.
  expect(relativeSpan("this-week", "2026-08-17")).toEqual({
    from: "2026-08-17",
    to: "2026-08-23",
  })
})

test("last week and next week are that span, seven days either way", () => {
  expect(relativeSpan("last-week", TODAY)).toEqual({
    from: "2026-08-03",
    to: "2026-08-09",
  })
  expect(relativeSpan("next-week", TODAY)).toEqual({
    from: "2026-08-17",
    to: "2026-08-23",
  })
  // And a week that crosses a year end is arithmetic rather than a special
  // case: the 1st of January 2026 is a Thursday.
  expect(relativeSpan("this-week", "2026-01-01")).toEqual({
    from: "2025-12-29",
    to: "2026-01-04",
  })
  expect(relativeSpan("last-week", "2026-01-01")).toEqual({
    from: "2025-12-22",
    to: "2025-12-28",
  })
})

test("the day words are the day, and the two beside it", () => {
  expect(relativeSpan("today", TODAY)).toEqual({ from: TODAY, to: TODAY })
  expect(relativeSpan("yesterday", TODAY)).toEqual({
    from: "2026-08-12",
    to: "2026-08-12",
  })
  expect(relativeSpan("tomorrow", TODAY)).toEqual({
    from: "2026-08-14",
    to: "2026-08-14",
  })
  // Across a year end, and across a leap February, by the same arithmetic.
  expect(relativeSpan("yesterday", "2026-01-01")?.from).toBe("2025-12-31")
  expect(relativeSpan("tomorrow", "2028-02-28")?.from).toBe("2028-02-29")
})

// A month and a year are handed to the SAME bounds the absolute forms use, so
// `date:this-month` and `date:2026-08` cannot disagree — including the upper
// bound being `-31` whether or not the month has one, which is that pair's own
// argued rule (no real day of the month exceeds it in a string comparison).
test("a month and a year resolve to the spans their written forms do", () => {
  expect(relativeSpan("this-month", TODAY)).toEqual({
    from: "2026-08-01",
    to: "2026-08-31",
  })
  expect(relativeSpan("last-month", TODAY)).toEqual({
    from: "2026-07-01",
    to: "2026-07-31",
  })
  expect(relativeSpan("next-month", TODAY)).toEqual({
    from: "2026-09-01",
    to: "2026-09-31",
  })
  expect(relativeSpan("last-month", "2026-01-15")).toEqual({
    from: "2025-12-01",
    to: "2025-12-31",
  })
  expect(relativeSpan("this-year", TODAY)).toEqual({
    from: "2026-01-01",
    to: "2026-12-31",
  })
  expect(relativeSpan("last-year", TODAY)?.from).toBe("2025-01-01")
  expect(relativeSpan("next-year", TODAY)?.to).toBe("2027-12-31")
})

test("a word the vocabulary does not hold resolves to nothing", () => {
  expect(relativeSpan("tomorrowish", TODAY)).toBeNull()
  expect(relativeSpan("this-day", TODAY)).toBeNull()
  expect(relativeSpan("last-fortnight", TODAY)).toBeNull()
  expect(relativeSpan("2026-08-10", TODAY)).toBeNull()
  // A clock that says nothing is not a day to count from. No door can hand
  // that over — but inventing a Monday out of it would be this grammar
  // answering a date question from thin air.
  expect(relativeSpan("today", "")).toBeNull()
  expect(relativeSpan("this-week", "2026-02-30")).toBeNull()
})

// ...and the same words as a QUERY, over the corpus.

test("a relative word selects the days it names", () => {
  // `order` is scheduled for Monday the 10th, this week; `demo` was finished
  // on Monday the 3rd, the week before.
  expect(selects("date:this-week")).toEqual(["order"])
  expect(selects("date:last-week")).toEqual(["demo"])
  expect(selects("date:next-week")).toEqual([])
  expect(selects("date:this-month")).toEqual(["demo", "order"])
  expect(selects("date:last-month")).toEqual(["basil"])
  expect(selects("date:this-year")).toEqual(["basil", "demo", "order"])
  // Folded like every other token — `date:THIS-MONTH` is the same question.
  expect(selects("date:THIS-MONTH")).toEqual(["demo", "order"])
  // The negation is the clause's, unchanged: everything dated, minus this
  // week's.
  expect(selects("has:date -date:this-week")).toEqual(["basil", "demo"])
})

// The same node found from three different days, which is what pins the ±1:
// `order` is scheduled for the 10th.
test("the day words count from the day the query is asked on", () => {
  expect(selectsOn("date:today", "2026-08-10")).toEqual(["order"])
  expect(selectsOn("date:yesterday", "2026-08-11")).toEqual(["order"])
  expect(selectsOn("date:tomorrow", "2026-08-09")).toEqual(["order"])
  expect(selectsOn("date:today", TODAY)).toEqual([])
})

// A relative word is a `date:` VALUE, so a range takes one wherever it takes a
// written date — the low end of the left span, the high end of the right.
test("a relative word composes with a range at either end", () => {
  expect(selects("date:last-week..")).toEqual(["demo", "order"])
  expect(selects("date:..last-week")).toEqual(["basil", "demo"])
  expect(selects("date:last-month..last-week")).toEqual(["basil", "demo"])
  expect(selects("date:2026-08-04..today")).toEqual(["order"])
  // ...and a range is still held to both ends: one word it cannot read refuses
  // the whole query.
  expect(refusalsOf("date:last-week..soonish")).toHaveLength(1)
  expect(refusalsOf("date:whenever..today")).toHaveLength(1)
})

// The refusal contract, extended rather than excepted: a word the vocabulary
// does not hold is a known operator with an unknown value, so it is REFUSED —
// never quietly searched for as the text `tomorrowish`, and never answered
// with an empty page and no reason.
test("a relative word the grammar does not know is refused, and names them all", () => {
  const refused = refusalsOf("date:tomorrowish")
  expect(refused?.map((one) => one.token)).toEqual(["date:tomorrowish"])
  // In full, generatively: the three day words, and the two lists the other
  // nine are the product of — so any of the twelve can be written off the
  // sentence, without a line nobody reads to the end.
  expect(refused?.[0]?.reason).toContain("today, yesterday, tomorrow")
  expect(refused?.[0]?.reason).toContain("this- / last- / next- with week, month, year")
  // ...and the words it teaches are the words it takes. Read off the same
  // sentence, so a table that grew a value nobody taught fails here.
  for (const word of ["today", "yesterday", "tomorrow"]) {
    expect(relativeSpan(word, TODAY)).not.toBeNull()
  }
  for (const step of ["this", "last", "next"]) {
    for (const unit of ["week", "month", "year"]) {
      expect(relativeSpan(`${step}-${unit}`, TODAY)).not.toBeNull()
    }
  }
  expect(selects("date:tomorrowish")).toEqual([])
  // Quoted as typed, like every other refusal.
  expect(refusalsOf("Date:Tomorrowish")?.[0]?.token).toBe("Date:Tomorrowish")
})

test("`-` negates whichever kind of token it is in front of", () => {
  expect(selects("#home -is:done")).toEqual(["herbs", "kitchen", "hinges"])
  expect(selects("cabinets -is:doing")).toEqual(["install"])
  expect(selects("is:done -basil")).toEqual(["demo"])
  // A bare `-` is a character somebody typed, not a negation of nothing — so
  // it is a word to look for, and nothing in this corpus holds one.
  expect(parseFilter("-", TODAY).kind).toBe("asking")
  expect(selects("-")).toEqual([])
})

test("clauses and words compose", () => {
  expect(selects("#home is:todo")).toEqual(["hinges"])
  expect(selects("has:date is:doing")).toEqual(["order"])
})

// ── properties ─────────────────────────────────────────────────────────

/**
 * `prop:` is the question `has:` asks of a FIELD, asked of a map with no fixed
 * list of keys — which is why it takes the key as its value rather than
 * appearing as more rows in that table.
 */
test("`prop:key` finds every node carrying that key", () => {
  expect(selects("prop:pr")).toEqual(["order"])
  expect(selects("prop:agent")).toEqual(["basil", "order"])
  expect(selects("prop:isbn")).toEqual([])
})

test("`prop:key=value` finds the nodes whose value is that", () => {
  // The query the design was written for: every lane this agent ran, out of
  // facts nobody had to re-parse by eye.
  expect(selects("prop:agent=claude-opus")).toEqual(["basil", "order"])
  expect(selects("prop:agent=codex")).toEqual([])
  // A LIST matches on any member — a fact can be several.
  expect(selects("prop:tags=walnut")).toEqual(["order"])
})

/**
 * CASE IS FOLDED ON BOTH HALVES, which is this grammar's rule rather than a new
 * one — `#Home` finds `#home`. `order` carries `agent: "Claude-Opus"` and
 * `basil` carries `agent: "claude-opus"`; both are the same answer to the same
 * question, because a property is something somebody typed into a map that
 * gives no key a spelling.
 */
test("a key and a value are found however they were capitalised", () => {
  expect(selects("prop:AGENT")).toEqual(["basil", "order"])
  expect(selects("prop:Agent=Claude-Opus")).toEqual(["basil", "order"])
})

/** It reads `custom` and nothing else — a field of the record is not a
 *  property, however much the word looks like one. `is:done` is how a mark is
 *  asked about, and there is exactly one way to ask each question. */
test("a field is not a property, so `prop:` does not find one", () => {
  expect(selects("prop:date=2026-08-10")).toEqual([])
  expect(selects("prop:done")).toEqual([])
  expect(selects("prop:see=herbs")).toEqual([])
})

test("`prop:` composes and negates like every other clause", () => {
  expect(selects("prop:agent -is:done")).toEqual(["order"])
  expect(selects("is:done -prop:agent")).toEqual(["demo"])
})

test("a `prop:` token with no key, or a key with an empty value, is refused", () => {
  expect(refusalsOf("prop:")?.[0]?.reason).toContain("no value")
  // Not "matches nothing": a key holding nothing is a key the file does not
  // carry, so `prop:stage=` could only ever select nothing — silently.
  expect(refusalsOf("prop:stage=")?.[0]?.reason).toContain("prop:agent=claude-opus")
  expect(refusalsOf("prop:=x")?.[0]?.reason).toContain("prop:pr")
})

/** The first `=` splits it, so a value may hold its own. A URL with a query
 *  string is the ordinary case, not a corner. */
test("a value may contain an equals sign", () => {
  const filter = parseFilter("prop:source=https://news.ycombinator.com/item?id=6560560", TODAY)
  expect(filter.kind).toBe("asking")
  if (filter.kind !== "asking") return
  expect(filter.clauses[0]?.clause).toEqual({
    kind: "prop",
    key: "source",
    value: "https://news.ycombinator.com/item?id=6560560",
  })
})

// ── refusals ───────────────────────────────────────────────────────────

/** What a refused query says, or `null` when it was not refused. Written as a
 *  narrowing rather than a field read, which is the union's own point: the
 *  refusals exist only on the arm that has them. */
const refusalsOf = (text: string): ReadonlyArray<Refusal> | null => {
  const filter = parseFilter(text, TODAY)
  return filter.kind === "refused" ? filter.refusals : null
}

test("a known operator with an unknown value is refused, and teaches", () => {
  const refused = refusalsOf("is:blocked")
  expect(refused?.map((one) => one.token)).toEqual(["is:blocked"])
  expect(refused?.[0]?.reason).toContain("done, doing, todo, marked, archived")
  // Refused means it selects NOTHING — never "the half of the query I could
  // read", which is the silent error that would look like an answer. The union
  // is what makes that structural: a refused filter HAS no terms to fall back
  // on.
  expect(refusalsOf("is:blocked kitchen")).toHaveLength(1)
  expect(selects("is:blocked kitchen")).toEqual([])
})

test("each operator says what it takes", () => {
  expect(refusalsOf("has:tags")?.[0]?.reason).toContain("desc, date, see, after, doc")
  expect(refusalsOf("date:soon")?.[0]?.reason).toContain("2026-08-10")
  expect(refusalsOf("date:..")).toHaveLength(1)
})

// A DAY that no month has is the reader's mistake exactly as `date:soon` is —
// and the worse of the two to swallow, because `2026-13` sorts between December
// and January and so reads as a window rather than as nonsense. It used to parse
// shape-clean and select nothing, with no reason given.
test("a date no calendar could hold is refused, not answered with an empty tree", () => {
  for (const impossible of ["date:2026-13", "date:2026-00", "date:2026-08-32", "date:2026-01-00"]) {
    expect(refusalsOf(impossible)).toHaveLength(1)
    expect(selects(impossible)).toEqual([])
  }
  // Both ends of a range are held to it.
  expect(refusalsOf("date:2026-13..2026-14")).toHaveLength(1)
  expect(refusalsOf("date:..2026-99")).toHaveLength(1)
  expect(refusalsOf("date:2026-99..")).toHaveLength(1)
  // ...and the shapes that ARE possible still parse.
  expect(parseFilter("date:2026-12-31", TODAY).kind).toBe("asking")
  expect(parseFilter("date:2026-01", TODAY).kind).toBe("asking")
})

// The line is what is impossible in ANY month, not in the month named. Telling
// `2026-02-30` from `2026-01-30` needs a calendar, and this grammar's whole date
// stance is that a comparison over text answers without inventing one — so it is
// accepted, and matches nothing.
test("a day that only some months have is accepted, and finds nothing", () => {
  expect(parseFilter("date:2026-02-30", TODAY).kind).toBe("asking")
  expect(selects("date:2026-02-30")).toEqual([])
})

// A space after the colon is not "date: takes a day, month or year" — the reader
// wrote a day. It is the tokenizer splitting one word into two, and the refusal
// says THAT.
test("an operator given no value says what actually went wrong", () => {
  expect(refusalsOf("is:")?.[0]?.reason).toContain("no value")
  expect(refusalsOf("date: 2026")?.[0]).toEqual({
    token: "date:",
    reason:
      "date: was given no value — a space after the colon splits it into two words",
  })
})

// The words are matched FOLDED and the refusal is quoted AS TYPED. Telling
// somebody who wrote `is:BLOCKED` that they wrote `is:blocked` is the refusal
// misquoting the reader — the same defect class the refusal exists to prevent.
test("a refusal quotes the token the way it was typed", () => {
  expect(refusalsOf("is:BLOCKED")?.[0]?.token).toBe("is:BLOCKED")
  expect(refusalsOf("Date:Soon")?.[0]?.token).toBe("Date:Soon")
  expect(refusalsOf("-HAS:tags")?.[0]?.token).toBe("-HAS:tags")
  // ...while everything that MATCHES still folds, so the two cannot be confused.
  expect(selects("IS:DONE")).toEqual(["basil", "demo"])
  expect(selects("#HOME")).toEqual(["herbs", "kitchen", "hinges"])
  expect(selects("CABINETS")).toEqual(["order", "install"])
})

test("a colon after anything else is a colon in a word", () => {
  // Not refused, and not a clause: three tokens the matcher looks for as text.
  expect(refusalsOf("todo: http://example.com")).toBe(null)
  expect(selects("todo:")).toEqual([])
  expect(selects("order:")).toEqual([])
})

// ── the archive ────────────────────────────────────────────────────────

test("what was put away stays put away until it is asked for", () => {
  // `gone` carries `#home` and the word `kitchen`, and answers neither.
  expect(selects("#home")).not.toContain("gone")
  expect(selects("kitchen")).toEqual(["kitchen"])
  expect(selects("is:archived")).toEqual(["gone"])
  expect(selects("#home is:archived")).toEqual(["gone"])
  // Saying it out loud is the same default said out loud.
  expect(selects("#home -is:archived")).toEqual(["herbs", "kitchen", "hinges"])
})

// ── which field carried it ─────────────────────────────────────────────

test("the field a match is reported under is the highest-weighted one that held it", () => {
  const [hit] = matching(derived, parseFilter("cabinets order", TODAY))
  expect(hit?.match.field).toBe("title")
  const [note] = matching(derived, parseFilter("walnut", TODAY))
  expect(note?.match.field).toBe("desc")
  // A query of operators alone is carried by no field at all.
  const [marked] = matching(derived, parseFilter("is:todo", TODAY))
  expect(marked?.match.field).toBe(null)
})

// ── which PROPERTY carried it ──────────────────────────────────────────

/**
 * The other half of "why is this here", and a SEPARATE half — the ruling this
 * change was made to record (`./searching.ts`'s `matchedProps`).
 *
 * `field` names one of four places a WORD is looked for; this names a key
 * somebody invented. They can both be true of one hit, which is the whole
 * reason there are two of them.
 */
const propsOf = (text: string): ReadonlyArray<string> =>
  matching(derived, parseFilter(text, TODAY))[0]?.match.props ?? []

test("a `prop:` clause names the key it selected on, beside the field the words did", () => {
  const [both] = matching(derived, parseFilter("cabinets prop:agent", TODAY))
  // BOTH, from one hit: the title carried the word and the map carried the key.
  expect(both?.match.field).toBe("title")
  expect(both?.match.props).toEqual(["agent"])
})

test("a query that names no property says so with an empty list", () => {
  expect(propsOf("cabinets")).toEqual([])
  expect(propsOf("is:todo")).toEqual([])
})

test("every positive clause is named, once, however many times it is asked", () => {
  expect(propsOf("prop:agent prop:pr")).toEqual(["agent", "pr"])
  // `prop:pr prop:pr=…` is one key a reader would otherwise see twice.
  expect(propsOf("prop:pr prop:pr=https://github.com/juspay/olai/pull/176"))
    .toEqual(["pr"])
})

/** The NODE's spelling, not the query's. The query is folded — `prop:PR` finds
 *  a key written `pr` — and a reader of this wants to look the key up in the
 *  map the hit carries, which is keyed the way the file wrote it. */
test("the key is reported as the NODE spells it, whatever was typed", () => {
  expect(propsOf("prop:AGENT")).toEqual(["agent"])
  expect(propsOf("prop:Agent=Claude-Opus")).toEqual(["agent"])
})

/** A node selected by a NEGATED clause was not selected ON that key — it is
 *  here because it carries no such key at all, and a row that pointed at
 *  `agent` would be drawing a lie the matcher never told. */
test("a negated clause names nothing, because nothing carried it", () => {
  const [hit] = matching(derived, parseFilter("is:done -prop:agent", TODAY))
  expect(hit?.at.node.id).toBe("demo")
  expect(hit?.match.props).toEqual([])
})

// ── scope ──────────────────────────────────────────────────────────────

test("a scope narrows to one outline, or to one node and everything beneath it", () => {
  const home = parseFilter("#home", TODAY)
  expect(
    matching(derived, home, { file: "garden.olai" }).map(({ at }) => at.node.id),
  ).toEqual(["herbs"])
  expect(
    matching(derived, home, { under: "kitchen" }).map(({ at }) => at.node.id),
  ).toEqual(["kitchen", "hinges"])
  // The node named is IN its own scope — "under `hinges`" is `hinges` and
  // nothing else, rather than nothing at all.
  expect(
    matching(derived, home, { under: "hinges" }).map(({ at }) => at.node.id),
  ).toEqual(["hinges"])
})

// ── the tree, narrowed ─────────────────────────────────────────────────

/** A tree flattened to `id` per line, indented — what the page draws. */
const drawn = (rows: ReadonlyArray<Row>, depth = 0): ReadonlyArray<string> =>
  rows.flatMap((row) => [
    `${"  ".repeat(depth)}${shownRecord(row).node.id}`,
    ...drawn(row.children, depth + 1),
  ])

const narrowed = (file: string, text: string): ReadonlyArray<string> => {
  const filter = parseFilter(text, TODAY)
  const matched = new Set(matching(derived, filter).map(({ at }) => at.node.id))
  return drawn(keeping(rowsOf(derived, file), matched))
}

test("a match keeps the ancestors that lead to it, and drops everything else", () => {
  expect(narrowed("house.olai", "hinges")).toEqual([
    "kitchen",
    "  install",
    "    hinges",
  ])
})

test("a match keeps its whole subtree — you asked for the thing", () => {
  expect(narrowed("house.olai", "install")).toEqual([
    "kitchen",
    "  install",
    "    hinges",
  ])
})

test("nothing matching is an empty tree rather than the tree it started as", () => {
  expect(narrowed("house.olai", "nothing-is-called-this")).toEqual([])
})

test("a mirror is narrowed by the node it SHOWS, wherever it is drawn", () => {
  // `herbs` lives in garden.olai and is mirrored under `kitchen`. Filtering
  // house.olai for it keeps the placement, with its ancestor.
  expect(narrowed("house.olai", "herb")).toEqual([
    "kitchen",
    "  herbs",
    "    basil",
  ])
})

test("the count is of PLACES, which is what a reader counts on the screen", () => {
  const filter = parseFilter("#home", TODAY)
  const matched = new Set(matching(derived, filter).map(({ at }) => at.node.id))
  const house = keeping(rowsOf(derived, "house.olai"), matched)
  // `kitchen`, `hinges`, and the mirror of `herbs` under `kitchen` — three
  // rows on screen for two nodes plus a placement.
  expect(matchedIn(house, matched)).toBe(3)
})
