import { expect, test } from "bun:test"

import { datedIn, datedOn, type DayGroup } from "./dates.ts"
import { derive, type Derived, type Row, rowsOf } from "./derive.ts"
import {
  keeping,
  keepingDated,
  litBy,
  matchedIn,
  matching,
  needlesFrom,
  parseFilter,
  type Refusal,
  ranked,
  relativeSpan,
  shownRecord,
} from "./filter.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
import { isPutAway } from "./node.ts"

/** One corpus, standing in for a directory: marks, dates, notes, edges, tags,
 *  a repeat rule, a mirror, an archive beside it — and a chain of `after`
 *  edges that crosses a file, so blockedness has something to be derived from.
 *  Every assertion below is about this.
 *
 *  THE STAMPS ARE ON SOME RECORDS AND NOT OTHERS, deliberately, because that
 *  is the directory the stamp operators actually meet: they arrived after the
 *  format did, so `kitchen`, `demo`, `garden` and `herbs` are nodes written
 *  before they existed and carry none. Nothing invents a past for them, and
 *  the pair of tests that says so is the honesty rule those two operators are
 *  held to. `install` carries a `created` with no `changed` beside it, which
 *  is the record saying nothing has been written to it since it was captured.
 *  Instants, not days, so the cut to a day is exercised rather than assumed. */
const CORPUS = {
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters","done":"2026-08-03"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"date":"2026-08-10","repeat":"every week on monday","desc":"walnut or birch","after":["demo"],"see":["herbs"],"created":"2026-08-01T09:12:44-04:00","changed":"2026-08-13T10:02:00-04:00","custom":{"agent":"Claude-Opus","pr":"https://github.com/juspay/olai/pull/176","tags":["cabinets","walnut"]}}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","doc":"finishes.md","after":["order"],"created":"2026-08-13T08:00:00-04:00"}`,
    `{"id":"hinges","parent":"install","ord":"a0","title":"pick the hinges #home","todo":"2026-08-11","after":["order"],"created":"2026-07-20T14:30:00-04:00","changed":"2026-08-11T09:00:00-04:00"}`,
    `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
  ].join("\n"),
  "garden.olai": [
    `{"id":"garden","ord":"a0","title":"garden #outdoors"}`,
    `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed #home","doing":true,"after":["hinges"]}`,
    `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20","created":"2025-12-31T23:59:00-05:00","changed":"2026-08-10T07:00:00-04:00","custom":{"agent":"claude-opus"}}`,
  ].join("\n"),
  "_olai/Trash.olai": [
    `{"id":"gone","ord":"a0","title":"the old kitchen table #home","done":"2026-06-01","created":"2026-06-01T10:00:00-04:00"}`,
  ].join("\n"),
}

const derived = derive(nodesOfFiles(CORPUS))

/**
 * THE SAME CORPUS WITH TWO OF ITS TARGETS CALLED OFF — `demo` (which `order`
 * waits on) and `order` (which `install` and `hinges` both wait on).
 *
 * A second derivation rather than more records in the first, which is the
 * reason `./dates.test.ts` keeps two: the corpus above is what every other
 * assertion in this file stands on, and a fourth mark added INTO it would move
 * answers that are about something else. Everything here is that corpus with
 * two values replaced, so what the assertions using it are about is the marks
 * and nothing else.
 *
 * The two shapes a settling mark comes in are both here on purpose: `demo`
 * carries an INSTANT and no `date` of its own, so the only thing that can put
 * it on a day is the mark; `order` carries a bare `true` beside a real `date`,
 * which is the shape that says the state was reached and declines to say when.
 */
const CALLED_OFF = derive(nodesOfFiles({
  ...CORPUS,
  "house.olai": CORPUS["house.olai"]
    .replace(`"done":"2026-08-03"`, `"cancelled":"2026-08-03T11:00:00-04:00"`)
    .replace(`"doing":true,"date":"2026-08-10"`, `"cancelled":true,"date":"2026-08-10"`),
}))

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

/** The ids a query selects out of a derivation, in the set's own order — for
 *  the tests that ask a corpus, or a day, other than the one above. */
const selectsIn = (
  derivation: Derived,
  text: string,
  today = TODAY,
): ReadonlyArray<string> =>
  matching(derivation, parseFilter(text, today)).map(({ at }) => at.node.id)

/** The ids a query selects, in the set's own order — asked on {@link TODAY},
 *  or on some other day, which is what the three day-words need since each of
 *  them names a different one. */
const selects = (text: string, today = TODAY): ReadonlyArray<string> =>
  selectsIn(derived, text, today)

// ── the grammar ────────────────────────────────────────────────────────

// The three states a query can be in, and they are three different things to
// DO: draw the page whole, draw nothing and say why, or ask.
test("nothing typed, refused, and asking are told apart", () => {
  expect(parseFilter("", TODAY).kind).toBe("nothing")
  expect(parseFilter("   ", TODAY).kind).toBe("nothing")
  expect(parseFilter("is:done", TODAY).kind).toBe("asking")
  expect(parseFilter("is:open", TODAY).kind).toBe("refused")
  expect(selects("is:open")).toEqual([])
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
  // The FIELD, which is a different question from what the node is waiting on
  // — see the blockedness section below, where these four part company.
  expect(selects("has:after")).toEqual(["herbs", "order", "install", "hinges"])
  // `order` is the one node here that comes back — one more plain field test,
  // and one line like its four siblings. That the dash and the words compose
  // with it is the grammar's, pinned once for every clause below.
  expect(selects("has:repeat")).toEqual(["order"])
})

// The one thing the table alone does not say, and the reason `has:repeat` is
// not a second way of asking `has:date`: a repeating node is a DATED one
// carrying a rule (./parse.ts refuses a rule without a date), so this selects
// inside that — and the difference between them is everything dated once.
test("`has:repeat` is inside `has:date`, and the difference is what is dated once", () => {
  expect(selects("has:date")).toEqual(["basil", "demo", "order"])
  expect(selects("has:date -has:repeat")).toEqual(["basil", "demo"])
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
  expect(selectsIn(hollow, "has:desc")).toEqual(["real"])
  expect(selectsIn(hollow, "has:see")).toEqual([])
  expect(selectsIn(hollow, "has:after")).toEqual([])
})

/**
 * ...AND A HOLLOW STAMP IS THE SAME ANSWER, which needs its own test because
 * it is not the same CODE: `desc` and the edge lists go through `carries`,
 * which asks the writer's `nothing`, while the two stamps go through
 * `stampWithin`. "The writer's list, asked as a question rather than restated"
 * is therefore a claim about two functions, and this pins the second one.
 * Without it `dayOf("")` is `""`, an unbounded span holds of every day
 * including that one, and `has:created` selects a record `has:desc` calls
 * empty — two answers to one word, from the one grammar that keeps refusing
 * them.
 *
 * THE FIXTURE CANNOT BE JSONL, and that is the honest scope of this row rather
 * than a wrinkle in writing it. `created` is validated ISO per line
 * (./parse.ts, the same loop that checks the marks and `date`), so
 * `{"created":""}` is a `bad-date` and never reaches a reader through a parsed
 * file — `nodesOfFiles` refuses it outright, which is how this test first
 * failed. So the record is built here by hand, and what it pins is the matcher
 * answering over A SET THE VALIDATOR HAS ALREADY CONDEMNED — a case this file
 * meets elsewhere on purpose (a mirror chain that closes a loop, a parent that
 * is missing) and answers rather than assumes away. A hand-edited outline,
 * a bad merge, and a half-written line are all how one arrives.
 */
test("a hollow stamp is a stamp the record does not carry", () => {
  const at = (id: string, created: string, line: number) => ({
    file: "a.olai",
    line,
    node: { id, ord: `a${line}`, title: id, created },
  })
  const condemned = derive([
    at("blank", "", 1),
    at("real", "2026-08-01T09:00:00-04:00", 2),
  ])
  expect(selectsIn(condemned, "has:created")).toEqual(["real"])
  // ...and the negation answers with it, which is the absent-stamp law reading
  // a field that is present and hollow exactly as it reads one that is gone.
  expect(selectsIn(condemned, "-has:created")).toEqual(["blank"])
  // The BOUNDED form never disagreed — `"" >= "2000-01-01"` is false — so what
  // this pins is the unbounded reading, against both of its spellings.
  expect(selectsIn(condemned, "created:2000..2100")).toEqual(["real"])
})

test("`date:` reads the three dates a journal reads — scheduled, finished, called off", () => {
  // `order` is scheduled for the 10th; `demo` was finished on the 3rd.
  expect(selects("date:2026-08-10")).toEqual(["order"])
  expect(selects("date:2026-08-03")).toEqual(["demo"])
  // A dated `doing` or `todo` is on no day here, exactly as a day page reads
  // it: `kitchen` carries `doing:2026-08-01` and is on no day.
  expect(selects("date:2026-08-01")).toEqual([])
  // ...and `hinges` carries `todo:2026-08-11`.
  expect(selects("date:2026-08-11")).toEqual([])

  // THE THIRD, over the corpus that has one (grok, review of #391). This test
  // named "the two dates" and ran only over the corpus where that was still
  // true, so `date:` reaching a cancelled instant was a claim `datesOf` made
  // and nothing here asked about. `CALLED_OFF` is the same corpus with `demo`
  // called off at 11:00 on the 3rd instead of finished, and `order` called off
  // — the day each of them lands on is the day the mark's instant names, and
  // the SCHEDULED half is untouched, which is what says this widened rather
  // than swapped one reading for another.
  expect(selectsIn(CALLED_OFF, "date:2026-08-03")).toEqual(["demo"])
  expect(selectsIn(CALLED_OFF, "date:2026-08-10")).toEqual(["order"])
  // `order` carries a bare `cancelled: true` beside its `date`, and a mark
  // holding `true` says the state was reached and declines to say when — so
  // the only day it is on is the one it is scheduled for.
  expect(selectsIn(CALLED_OFF, "has:date")).toEqual(["basil", "demo", "order"])
  // …and the unsettled marks are still on no day, whichever corpus is asked.
  expect(selectsIn(CALLED_OFF, "date:2026-08-01")).toEqual([])
  expect(selectsIn(CALLED_OFF, "date:2026-08-11")).toEqual([])
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

// A day or an INSTANT on one, cut down by the same `dayOf` every date reading
// in this package uses — the ruling `isOverdue` made about the same parameter,
// so a door that hands over its clock's own text (the ops layer's `now`, a
// local ISO datetime with its offset) counts from the right day rather than
// being refused for not having trimmed it first.
test("an instant is the day it falls on", () => {
  expect(relativeSpan("today", `${TODAY}T15:40:03-04:00`)).toEqual({
    from: TODAY,
    to: TODAY,
  })
  expect(relativeSpan("this-week", `${TODAY}T00:00:00+05:30`)).toEqual({
    from: "2026-08-10",
    to: "2026-08-16",
  })
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

// THE VOCABULARY IS A MAP, AND THIS IS WHY. The key is a word somebody typed,
// and an object would have answered for its prototype as well as for the table
// — with a value of the wrong kind. `date:constructor` minted a bound with a
// function's source text glued to the day; `date:__proto__-week` minted
// `2026-08-NaN`. Both select nothing and say nothing, which is the exact
// silence the refusal arm exists to prevent.
test("a word the prototype answers for is not a word this vocabulary holds", () => {
  for (const word of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
    expect(relativeSpan(word, TODAY)).toBeNull()
    expect(relativeSpan(`${word}-week`, TODAY)).toBeNull()
    expect(relativeSpan(`this-${word}`, TODAY)).toBeNull()
  }
  // …and through the grammar, where it matters: REFUSED, in the words the
  // operator takes, rather than answered with an empty page.
  for (const token of ["date:constructor", "date:__proto__", "date:__proto__-week"]) {
    expect(refusalsOf(token)?.map((one) => one.token)).toEqual([token])
    expect(selects(token)).toEqual([])
  }
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
  expect(selects("date:today", "2026-08-10")).toEqual(["order"])
  expect(selects("date:yesterday", "2026-08-11")).toEqual(["order"])
  expect(selects("date:tomorrow", "2026-08-09")).toEqual(["order"])
  expect(selects("date:today", TODAY)).toEqual([])
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

// ── quoted phrases ─────────────────────────────────────────────────────

/**
 * A phrase is a term whose word holds a space, and that is the whole of it: the
 * tokenizer stopped ending a token at a space, and the matcher — which was
 * already looking for a case-folded substring — went on doing exactly what it
 * did. So a phrase is looked for in the same four fields, weighted the same
 * way, and negated by the same dash.
 */
test("a phrase is one substring, where the words are four", () => {
  expect(selects(`"the cabinets"`)).toEqual(["order", "install"])
  // The pair that says what quoting BUYS: the same two words, unquoted, are
  // two independent substrings and the order between them stops mattering.
  expect(selects(`"cabinets the"`)).toEqual([])
  expect(selects("cabinets the")).toEqual(["order", "install"])
  expect(selects(`"kitchen remodel"`)).toEqual(["kitchen"])
})

test("a phrase is folded and negated like any other word", () => {
  expect(selects(`"The Cabinets"`)).toEqual(["order", "install"])
  expect(selects(`#home -"kitchen remodel"`)).toEqual(["herbs", "hinges"])
  // A dash INSIDE the quotes is a character, which is the whole reason the
  // negation is read where the position of the dash is still known: `--force`
  // is a word people write, and so is `-force`.
  expect(parseFilter(`"-force"`, TODAY)).toEqual({
    kind: "asking",
    groups: [[{ kind: "term", word: "-force", negated: false }]],
    namedProps: [],
    speaksOfTrash: false,
  })
})

/** Quoting one word changes nothing — there is no second grammar for a phrase,
 *  only a token that reached the matcher with its spaces still in it. */
test("a phrase of one word is that word", () => {
  expect(selects(`"#home"`)).toEqual(["herbs", "kitchen", "hinges"])
  expect(selects(`"cabinets" "order"`)).toEqual(["order"])
})

/** It reaches the note as readily as the title, which is what the four fields
 *  being one scan means — and `matched` still says which one carried it. */
test("a phrase is found in a note, and says so", () => {
  const [hit] = matching(derived, parseFilter(`"walnut or birch"`, TODAY))
  expect(hit?.at.node.id).toBe("order")
  expect(hit?.match.field).toBe("desc")
})

/**
 * THE ESCAPE HATCH, and the reason quoting and `OR` are one change: the grammar
 * has claimed some spellings, and quoting is how a reader asks for the TEXT of
 * one. Without it there is no way at all to find the note in which somebody
 * wrote down what `is:done` means.
 */
test("a quoted operator is the text, not the operator", () => {
  const literal = derive(nodesOfFiles({
    "a.olai": [
      `{"id":"note","ord":"a0","title":"what is:done reads","todo":true}`,
      `{"id":"ticked","ord":"a1","title":"something else","done":"2026-08-01"}`,
    ].join("\n"),
  }))
  expect(selectsIn(literal, `"is:done"`)).toEqual(["note"])
  expect(selectsIn(literal, "is:done")).toEqual(["ticked"])
  // ...and a value the operator does not take is not refused once it is text:
  // `is:open` in quotes is a query about prose, and there is no operator in it
  // to have got wrong.
  expect(parseFilter(`"is:open"`, TODAY).kind).toBe("asking")
})

/**
 * A CONSEQUENCE RATHER THAN A RULE, and it is the one worth pinning: a phrase
 * is a substring of the field's own text, newlines and all, so words on two
 * lines of a note are not next to each other. Nothing in the matcher says so —
 * it falls out of the note being stored verbatim.
 */
test("a phrase does not cross the line break a note keeps", () => {
  const wrapped = derive(nodesOfFiles({
    "a.olai": `{"id":"list","ord":"a0","title":"the list","desc":"pick the\\nhinges"}`,
  }))
  expect(selectsIn(wrapped, "pick hinges")).toEqual(["list"])
  expect(selectsIn(wrapped, `"pick the hinges"`)).toEqual([])
})

test("a quote nothing closes is refused rather than closed for the reader", () => {
  const refused = refusalsOf(`"pick the`)
  // AS TYPED, opening quote and all — the token is what the reader wrote.
  expect(refused?.map((one) => one.token)).toEqual([`"pick the`])
  expect(refused?.[0]?.reason).toContain("a quote nothing closes")
  expect(selects(`"pick the`)).toEqual([])
  // The tokens BEFORE it were read, so a query that got two things wrong is
  // told about both — in the order they were typed.
  expect(refusalsOf(`kitchen "pick the`)).toHaveLength(1)
  expect(refusalsOf(`is:open "pick the`)?.map((one) => one.token))
    .toEqual(["is:open", `"pick the`])
  // ...but ONE thing wrong is told once. The reader did type a token after the
  // `OR`; the quote ran away with it before the scan reached it, and a joiner
  // refusal here would be a second mistake nobody made.
  expect(refusalsOf(`hinges OR "pick the`)?.map((one) => one.token))
    .toEqual([`"pick the`])
})

/** A lone quote is a quote nothing closes wherever it sits, which costs one
 *  term and is named rather than excepted: an inch mark cannot be searched for.
 *  The alternative is a second rule about the same character — it opens a
 *  region unless nothing closes it — which decides what a token means by
 *  reading the end of the line. */
test("a quote in the middle of a word is still a quote", () => {
  expect(refusalsOf(`36"`)?.[0]?.reason).toContain("a quote nothing closes")
  // Closed, it is the space-suspending half of the rule and nothing more: the
  // token still starts with `prop:`, so it is still an operator.
  expect(parseFilter(`prop:stage="in review"`, TODAY).kind).toBe("asking")
})

/** An empty needle is inside every node ever written, so `""` is the query that
 *  answers with the whole directory — refused for `prop:stage=`'s reason, from
 *  the other end: a token that names a shape and then holds nothing.
 *
 *  A PHRASE OF WHITESPACE is the same query with the same answer, and it is the
 *  half that slipped past the first spelling of this rule: `" "` is in every
 *  title that has two words in it. */
test("a phrase with no words in it is refused, space or nothing", () => {
  expect(refusalsOf(`""`)?.[0]?.reason).toContain("no words in it")
  expect(refusalsOf(`-""`)).toHaveLength(1)
  expect(selects(`""`)).toEqual([])
  expect(refusalsOf(`" "`)).toHaveLength(1)
  expect(selects(`" "`)).toEqual([])
  expect(selects(`"  "`)).toEqual([])
  // ...while a phrase that HOLDS a space is what all this is for.
  expect(selects(`"the cabinets"`)).toEqual(["order", "install"])
})

// ── OR ─────────────────────────────────────────────────────────────────

/** `OR` joins the tokens on either side of it; the groups it makes are ANDed
 *  exactly as adjacent tokens always were. Both kinds of token can be an
 *  alternative, because both were always the same conjunction. */
test("`OR` is satisfied by any one of the tokens it joins", () => {
  expect(selects("basil OR hinges")).toEqual(["basil", "hinges"])
  expect(selects("basil OR hinges OR garden")).toEqual(["garden", "basil", "hinges"])
  expect(selects("is:todo OR is:doing")).toEqual(["herbs", "kitchen", "order", "hinges"])
  // ...which is a second spelling of a question the grammar could already ask,
  // and the two answer alike: work, unfinished.
  expect(selects("is:marked -is:done")).toEqual(selects("is:todo OR is:doing"))
  // A word and a clause in one group — the union the two token lists became.
  expect(selects("#home OR is:done")).toEqual([
    "herbs",
    "basil",
    "kitchen",
    "demo",
    "hinges",
  ])
})

/**
 * THE PRECEDENCE RULING, and it is the whole design. `OR` binds TIGHTER than
 * the conjunction between adjacent tokens, so this is `#home` AND one of the
 * other two.
 *
 * Read the other way round — `(#home AND kitchen) OR cabinets` — the answer
 * also holds `order` and `install`, which carry no `#home` at all: a query that
 * quietly WIDENED, which is worse than one that found nothing, because the
 * extra rows look exactly like a search working.
 */
test("`OR` binds tighter than the AND between adjacent tokens", () => {
  expect(selects("#home kitchen OR cabinets")).toEqual(["kitchen"])
  expect(selects("cabinets")).toEqual(["order", "install"])
  // ...and from the OTHER side, which is the half a rule about "the tokens on
  // either side of it" has to be held to as well: `(garden OR cabinets) AND
  // the`. The loose reading — `garden OR (cabinets AND the)` — would also
  // answer with `garden`, whose title carries no `the` at all.
  expect(selects("garden OR cabinets the")).toEqual(["order", "install"])
  expect(selects("garden")).toEqual(["garden"])
  // Negation is a token's, so it composes inside a group like anything else.
  expect(selects("is:doing -herbs OR is:todo")).toEqual(["kitchen", "order"])
})

/** A group is worth its BEST alternative, not the first one the reader
 *  happened to type: `order` carries `cabinets` in its title and `walnut` in
 *  its note, and which of the two is written first must not decide what the
 *  row says carried it. */
test("a group reports the highest-weighted field any of its words hit", () => {
  const best = (text: string) => matching(derived, parseFilter(text, TODAY))[0]?.match.field
  expect(best("walnut OR cabinets")).toBe("title")
  expect(best("cabinets OR walnut")).toBe("title")
})

/**
 * `OR` IS THE ONE TOKEN THIS GRAMMAR DOES NOT FOLD, because `or` is a word
 * people write — this corpus has a note that says `walnut or birch` — and a
 * joiner that answered for the lower-case one would have taken it out of the
 * language being searched.
 */
test("`or` is a word and `OR` is the joiner", () => {
  expect(selects("walnut or birch")).toEqual(["order"])
  // The same three tokens with the middle one shouted: two things to find
  // rather than three, and nothing holds all three.
  expect(selects("walnut OR hinges")).toEqual(["order", "hinges"])
  expect(selects("walnut or hinges")).toEqual([])
  // A leading dash makes it a token like any other, negated — the joiner is
  // the two characters and nothing else.
  expect(parseFilter("-OR", TODAY).kind).toBe("asking")
  expect(selects("-OR")).not.toContain("order")
})

/** ...and the other way out, for a note that shouts it: quoting. The two
 *  halves of this change are each other's escape hatch. */
test("a quoted `OR` is the word, in capitals", () => {
  const shouting = derive(nodesOfFiles({
    "a.olai": [
      `{"id":"ward","ord":"a0","title":"book the OR for Tuesday"}`,
      `{"id":"list","ord":"a1","title":"the theatre list"}`,
    ].join("\n"),
  }))
  expect(selectsIn(shouting, `"OR"`)).toEqual(["ward"])
})

test("an `OR` with nothing on one side of it is refused", () => {
  for (const text of ["OR", "OR kitchen", "kitchen OR", "kitchen OR OR basil"]) {
    const refused = refusalsOf(text)
    expect(refused?.map((one) => one.token)).toEqual(["OR"])
    expect(refused?.[0]?.reason).toContain("joins the token before it")
    expect(selects(text)).toEqual([])
  }
  // A refused token SPENDS the joiner: `is:open OR kitchen` is one mistake,
  // and a second refusal about the `OR` would be a mistake nobody made.
  expect(refusalsOf("is:open OR kitchen")?.map((one) => one.token)).toEqual(["is:open"])
  expect(refusalsOf("kitchen OR is:open")?.map((one) => one.token)).toEqual(["is:open"])
})

/**
 * A GROUP IS NOT NEGATED, and nothing is missing: the dash is a TOKEN's and
 * there are two binding levels, which is exactly enough for both of De Morgan's
 * readings without a parenthesis anywhere.
 *
 * `-a -b` is NEITHER — two groups, both of which must hold. `-a OR -b` is NOT
 * BOTH — one group, either half of which will do; `order` and `install` are the
 * two nodes carrying `cabinets` AND `the`, and they are exactly what it leaves
 * out.
 */
test("both De Morgan readings are sayable: neither, and not both", () => {
  expect(selects("#home -kitchen -herb")).toEqual(["hinges"])
  expect(selects("cabinets the")).toEqual(["order", "install"])
  expect(selects("-cabinets OR -the")).toEqual([
    "garden",
    "herbs",
    "basil",
    "kitchen",
    "demo",
    "hinges",
  ])
})

/** The archive is opened by the query NAMING it, wherever it is named — an
 *  alternative is part of the query exactly as a token has always been. */
test("an alternative that names the archive opens it", () => {
  expect(selects("is:trashed OR nothing-is-called-this")).toEqual(["gone"])
})

// ── blockedness ────────────────────────────────────────────────────────

/**
 * `is:blocked` is the one value here that is not a fact about the RECORD, and
 * these tests are about it being the app's own answer rather than a second one:
 * the index `derive.ts` builds is what dims a row and draws its `blocked by`
 * line, so a query that found a node the page does not draw as waiting — or
 * missed one it does — would be the drift this package exists to prevent.
 */
test("`is:blocked` finds what is waiting, across the whole directory", () => {
  // `hinges` waits on `order`, which is `doing`. `herbs` waits on `hinges`
  // FROM ANOTHER FILE — the derivation is of the set, so blockedness crosses an
  // outline exactly as it does on screen.
  expect(selects("is:blocked")).toEqual(["herbs", "hinges"])
})

/** An edge is not a wait, and `has:after` is how the other question is asked:
 *  `order` waits on `demo`, which is DONE, and `install` waits on `order` but
 *  is a plain bullet. Both carry the field; neither is being told it cannot
 *  start. The rules are `derive.ts`'s `blockage`'s, not restated by the
 *  grammar — this is where the two answers part company. */
test("an edge is not a wait: a finished target, and a source that is not work", () => {
  expect(selects("has:after -is:blocked")).toEqual(["order", "install"])
})

/**
 * ...and they part company the OTHER way too, which is why `is:blocked` is not
 * `has:after` with extra rules. `a blocks b` is the same arrow written from the
 * other end, normalised into one graph before anything reads it (`derive.ts`),
 * so a node can be waiting while carrying no `after` field at all — and the
 * field is what `has:after` sees.
 */
test("a `blocks` written on the other record is waited on all the same", () => {
  const sugared = derive(nodesOfFiles({
    "a.olai": [
      `{"id":"ship","ord":"a0","title":"ship it","todo":true}`,
      `{"id":"review","ord":"a1","title":"read it over","doing":true,"blocks":["ship"]}`,
    ].join("\n"),
  }))
  expect(selectsIn(sugared, "is:blocked")).toEqual(["ship"])
  expect(selectsIn(sugared, "has:after")).toEqual([])
})

test("`is:blocked` composes and negates like every other clause", () => {
  expect(selects("is:blocked is:todo")).toEqual(["hinges"])
  expect(selects("#home -is:blocked")).toEqual(["kitchen"])
})

/**
 * THE DERIVED HALF, and the whole of what makes this operator worth having: no
 * record moved — one mark did, on a node neither query mentions.
 *
 * Written as a substitution over the corpus above rather than as a second one,
 * so nothing else can have changed between the two readings.
 */
test("a node whose blocker is finished stops matching", () => {
  const finished = derive(nodesOfFiles({
    ...CORPUS,
    "house.olai": CORPUS["house.olai"].replace(`"doing":true`, `"done":"2026-08-12"`),
  }))
  // `order` is done, so `hinges` is waiting on nothing and is out of the answer
  // — while `herbs`, which waits on `hinges` rather than on `order`, is still
  // in it. One mark, one node.
  expect(selectsIn(finished, "is:done")).toContain("order")
  expect(selectsIn(finished, "is:blocked")).toEqual(["herbs"])
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
  expect(filter.groups[0]?.[0]).toEqual({
    kind: "clause",
    negated: false,
    clause: {
      kind: "prop",
      key: "source",
      value: "https://news.ycombinator.com/item?id=6560560",
    },
  })
})

/** ...and a quoted value is a value with a SPACE in it, which nothing else in
 *  the grammar can spell. The quote suspends the space; the token still begins
 *  with `prop:`, so it is still an operator — the two rules quoting is made of,
 *  meeting on one token. */
test("a value may hold a space, which is what quoting one is for", () => {
  const spaced = derive(nodesOfFiles({
    "a.olai": [
      `{"id":"one","ord":"a0","title":"the first","custom":{"stage":"in review"}}`,
      `{"id":"two","ord":"a1","title":"the second","custom":{"stage":"in"}}`,
    ].join("\n"),
  }))
  expect(selectsIn(spaced, `prop:stage="in review"`)).toEqual(["one"])
  // Without the quotes it is two tokens, and the second is a word nothing
  // holds — the query the reader did not mean, and the reason for the first.
  expect(selectsIn(spaced, "prop:stage=in review")).toEqual([])
})

// ── refusals ───────────────────────────────────────────────────────────

/** What a refused query says, or `null` when it was not refused. Written as a
 *  narrowing rather than a field read, which is the union's own point: the
 *  refusals exist only on the arm that has them.
 *
 *  The clock is an argument here for {@link selects}' reason — the durations
 *  are counted from a moment rather than a day, so their refusals are asked on
 *  one ({@link NOW}). */
const refusalsOf = (text: string, now: string = TODAY): ReadonlyArray<Refusal> | null => {
  const filter = parseFilter(text, now)
  return filter.kind === "refused" ? filter.refusals : null
}

test("a known operator with an unknown value is refused, and teaches", () => {
  const refused = refusalsOf("is:open")
  expect(refused?.map((one) => one.token)).toEqual(["is:open"])
  expect(refused?.[0]?.reason).toContain(
    "done, cancelled, doing, todo, marked, blocked, mirrored, trashed",
  )
  // Refused means it selects NOTHING — never "the half of the query I could
  // read", which is the silent error that would look like an answer. The union
  // is what makes that structural: a refused filter HAS no terms to fall back
  // on.
  expect(refusalsOf("is:open kitchen")).toHaveLength(1)
  expect(selects("is:open kitchen")).toEqual([])
})

test("`is:archived` is unknown — the operator is `is:trashed`", () => {
  const refused = refusalsOf("is:archived")
  expect(refused?.map((one) => one.token)).toEqual(["is:archived"])
  expect(refused?.[0]?.reason).toContain("trashed")
  expect(refused?.[0]?.reason).not.toContain("archived")
  expect(selects("is:archived")).toEqual([])
})

test("each operator says what it takes", () => {
  expect(refusalsOf("has:tags")?.[0]?.reason).toContain(
    "desc, date, created, changed, see, after, doc, repeat",
  )
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
// somebody who wrote `is:OPEN` that they wrote `is:open` is the refusal
// misquoting the reader — the same defect class the refusal exists to prevent.
test("a refusal quotes the token the way it was typed", () => {
  expect(refusalsOf("is:OPEN")?.[0]?.token).toBe("is:OPEN")
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

// ── mirrored ───────────────────────────────────────────────────────────

/**
 * `is:mirrored` IS THE ONE DIRECTION A MIRROR CAN BE ASKED ABOUT from here.
 *
 * A placement is never a hit — `matching` skips it, because a second view of a
 * node answered as a node would be the same node twice, once at a place no
 * write lands — so the question with a subject is the other one: is this NODE
 * drawn anywhere else? `herbs` is placed under `kitchen` as well as under
 * `garden`, and it is the only node in the corpus that is.
 */
test("`is:mirrored` finds the node a placement shows, never the placement", () => {
  expect(selects("is:mirrored")).toEqual(["herbs"])
  // The mirror RECORD is not among them, and not because it fails the test —
  // it is not a candidate at all.
  expect(selects("is:mirrored")).not.toContain("kitchen-herbs")
  // ...and the node it is filed UNDER is not mirrored by holding one.
  expect(selects("is:mirrored")).not.toContain("kitchen")
})

/** It reads `Derived.mirrorsOf`, which follows chains — so a mirror of a
 *  mirror of a node is a place that node is drawn, and the record in the
 *  middle collects nothing. Same index `read_node` answers `mirrors` from, so
 *  a query cannot find a placement that read does not report. */
test("a chain of placements is places the node at the end of it is drawn", () => {
  const chained = derive(nodesOfFiles({
    ...CORPUS,
    "shelf.olai": `{"id":"now-herbs","ord":"a0","mirror":"kitchen-herbs"}`,
  }))
  // `now-herbs` shows `kitchen-herbs` which shows `herbs`, so both placements
  // are filed under `herbs` and neither is filed under the one in the middle.
  expect(selectsIn(chained, "is:mirrored")).toEqual(["herbs"])
})

/** A chain that dangles shows no node and is filed nowhere — the same silence
 *  `Derived.status` keeps about one, rather than a second rule here. */
test("a placement pointing at nothing mirrors nothing", () => {
  const dangling = derive(nodesOfFiles({
    "a.olai": `{"id":"a","ord":"a","title":"a"}\n{"id":"m","ord":"b","mirror":"nobody"}`,
  }))
  expect(selectsIn(dangling, "is:mirrored")).toEqual([])
})

/** ...and it composes and negates like every other clause. The negation is the
 *  form that touches nearly every node, since almost nothing is placed twice. */
test("`is:mirrored` composes and negates", () => {
  expect(selects("#home is:mirrored")).toEqual(["herbs"])
  expect(selects("-is:mirrored")).not.toContain("herbs")
  expect(selects("herb -is:mirrored")).toEqual([])
  expect(selects("is:mirrored OR is:blocked")).toEqual(["herbs", "hinges"])
})

// ── the fourth mark, at this door ──────────────────────────────────────

/**
 * `is:cancelled` selects the STORED mark, and `is:marked` takes it in.
 *
 * The second half is why `is:marked` was never spelled as a list of three:
 * `is:marked -is:done -is:cancelled` is "work, unsettled", and it stayed
 * sayable the day the fourth mark landed rather than needing a value of its
 * own.
 */
test("`is:cancelled` selects the mark, and `is:marked` counts it", () => {
  expect(selectsIn(CALLED_OFF, "is:cancelled")).toEqual(["demo", "order"])
  // A parent whose child was called off is not itself cancelled — the stored
  // mark, never a derived one, exactly as `is:done` reads.
  expect(selectsIn(CALLED_OFF, "is:cancelled")).not.toContain("kitchen")
  expect(selectsIn(CALLED_OFF, "is:marked")).toContain("demo")
  expect(selectsIn(CALLED_OFF, "is:marked -is:done -is:cancelled"))
    .toEqual(["herbs", "kitchen", "hinges"])
  // And it negates and composes like every other clause.
  expect(selectsIn(CALLED_OFF, "-is:cancelled")).not.toContain("order")
  expect(selectsIn(CALLED_OFF, "cabinets is:cancelled")).toEqual(["order"])
})

/**
 * `is:blocked`, DIFFERENTIALLY — the new derivation against the one it
 * replaced, over a corpus whose `after` targets are cancelled.
 *
 * The old rule is written out below rather than remembered, because "cancelled
 * targets stop blocking" is a claim about a DIFFERENCE and a test that only
 * asserted the new answer could not tell a fix from a corpus that never
 * exercised it. What the reference spells is the rule as it stood — a target
 * blocks while it is a task that is not `done` — over the same three inputs
 * `blockage` takes, so the two differ in exactly one clause.
 *
 * The difference must be EXACTLY the nodes whose remaining blockers were all
 * called off, and nothing else: `hinges` still waits on nothing new, `herbs`
 * still waits on `hinges`, and no node that was free becomes blocked.
 */
test("`is:blocked` differs from the old derivation exactly at the cancelled targets", () => {
  /** Blockedness as it stood before the fourth mark: a target is in the way
   *  while it is a task that is not `done`, and has not been put away. */
  const blockedTheOldWay = (derivation: Derived): Array<string> =>
    [...derivation.after.keys()]
      .filter((id) => {
        const inPlay = (target: string): boolean => {
          const at = derivation.byId.get(target)
          if (at === undefined || isPutAway(at.file)) return false
          const mark = derivation.status.get(target)
          return mark !== undefined && mark !== "done"
        }
        return inPlay(id) &&
          (derivation.after.get(id) ?? []).some((target) => inPlay(target))
      })
      // The set's own order, so the two lists are comparable as lists.
      .sort()

  // On the corpus with no cancelled mark in it, the two derivations agree
  // exactly — which is what makes the disagreement below a fact about the
  // fourth mark rather than about this reference being written differently.
  expect(selects("is:blocked").slice().sort()).toEqual(blockedTheOldWay(derived))

  const was = blockedTheOldWay(CALLED_OFF)
  const now = selectsIn(CALLED_OFF, "is:blocked").slice().sort()

  // `order` was blocked by a cancelled `demo`, and is itself cancelled, so it
  // leaves at both ends. `hinges` waited on nothing but `order`, which has been
  // called off, so it leaves too. `herbs` waits on `hinges`, which is `todo`
  // and has not been settled — it stays, which is the half that says this
  // narrowed rather than emptied. (`install` is in neither list and was in
  // neither before: it is an unmarked bullet, and nothing tells a bullet it
  // cannot start.)
  expect(was).toEqual(["herbs", "hinges", "order"])
  expect(now).toEqual(["herbs"])
  // Strictly narrower: nothing became blocked that was not before.
  expect(now.every((id) => was.includes(id))).toBe(true)
})

/** It is taught with the rest of the values `is:` takes, off the same list the
 *  parser reads. */
test("`is:` teaches the mirrored value with the others", () => {
  expect(refusalsOf("is:mirror")?.[0]?.reason).toContain(
    "done, cancelled, doing, todo, marked, blocked, mirrored, trashed",
  )
})

// ── the stamps ─────────────────────────────────────────────────────────

/**
 * `created:` and `changed:` READ THE RECORD'S OWN STAMPS, where `date:` reads
 * the journal's two — so the three operators ask different questions of the
 * same node, and the corpus is built to tell them apart. `order` is scheduled
 * for the 10th, was captured on the 1st and was last written today: one node,
 * three different answers.
 */
test("the stamps are the record's own, and are not the journal's dates", () => {
  expect(selects("created:2026-08-01")).toEqual(["order"])
  expect(selects("changed:today")).toEqual(["order"])
  // ...and what the node is scheduled FOR is a third day again, on which
  // neither of its stamps falls.
  expect(selects("date:2026-08-10")).toEqual(["order"])
  expect(selects("created:2026-08-10")).toEqual([])
  expect(selects("changed:2026-08-10")).toEqual(["basil"])
})

/** A stamp is an INSTANT and a bound is a day, so the ten characters in front
 *  of the `T` are what is compared — the same cut ./dates.ts makes of a dated
 *  `done`, rather than a second reading of what a day is. */
test("a stamp is the day its instant falls on", () => {
  // Captured at 08:00 local on the 13th, and the 13th is what finds it.
  expect(selects("created:today")).toEqual(["install"])
  // ...and 2025-12-31T23:59 is the last day of that year rather than the first
  // of the next, which is what a parse into an instant could have made of it.
  expect(selects("created:2025-12-31")).toEqual(["basil"])
  expect(selects("created:2026-01-01")).toEqual([])
})

/**
 * THE VALUE GRAMMAR IS `date:`'s, whole and unchanged — which is the claim
 * behind the three being one list rather than three operators written out.
 * Every form that operator takes is asked of a stamp: a day above, and a
 * month, a year and the relative words here.
 */
test("a stamp takes every value a date does", () => {
  expect(selects("created:2026-07")).toEqual(["hinges"])
  expect(selects("created:2025")).toEqual(["basil"])
  expect(selects("created:this-week")).toEqual(["install"])
  expect(selects("changed:this-week")).toEqual(["basil", "order", "hinges"])
  expect(selects("changed:last-week")).toEqual([])
  expect(selects("created:last-month")).toEqual(["hinges"])
})

/** ...and it composes with a range at either end for free, because a relative
 *  word and a written one are read into the same span before either reaches a
 *  clause. */
test("a stamp range is the same two comparisons a date range is", () => {
  expect(selects("created:..2026-07-31")).toEqual(["basil", "hinges"])
  expect(selects("created:2026-08-01..")).toEqual(["order", "install"])
  expect(selects("created:2026-07-01..today")).toEqual(["order", "install", "hinges"])
  expect(selects("changed:yesterday..today")).toEqual(["order"])
})

/**
 * ABSENCE SELECTS NOTHING, and this is the honesty rule the pair is held to.
 *
 * The stamps arrived after the format did, so a node written before them
 * carries no `created` — and nothing here invents one. It offers no day, so no
 * bound can hold of it, and it is not found however wide the span: a ledger
 * does not make up a past it did not see (./node.ts), and `git log` is the
 * archaeologist's tool.
 */
test("a node with no stamp is not found by any span, however wide", () => {
  expect(selects("created:2000..")).not.toContain("kitchen")
  expect(selects("created:..2100")).not.toContain("kitchen")
  expect(selects("created:2026")).not.toContain("kitchen")
  expect(selects("changed:2000..2100")).toEqual(["basil", "order", "hinges"])
})

/**
 * ...AND THE NEGATION IS THE EXISTING LAW, not an exception carved for these
 * two: the dash negates the CLAUSE, and a clause that has nothing to read
 * cannot hold — so the unstamped nodes come back under `-created:` exactly as
 * a node with no date at all comes back under `-has:date`.
 *
 * Asserted BESIDE that one rather than described, because the claim is that
 * they are one rule: what a reader has learnt from the older operator is what
 * this one does.
 */
test("negation finds the unstamped, as `-has:date` already found the undated", () => {
  // A node with no `date` and no dated `done` is found by the negation.
  expect(selects("-has:date")).toContain("kitchen")
  // ...and a node with no `created` is found by the negation of a span, on
  // exactly that reading.
  expect(selects("-created:2026")).toContain("kitchen")
  expect(selects("-created:2000..2100")).toEqual(["garden", "herbs", "kitchen", "demo"])
})

/**
 * `has:created` / `has:changed` are those operators asked with NO BOUNDS, for
 * the reason `has:date` is one: a reader who finds a node with
 * `created:2026-08` and then cannot find it with `has:created` has met two
 * answers to one word.
 *
 * And the pair buys the one question the format itself names as a real answer
 * — a `changed` absent beside a `created` means nothing has been written to
 * the node since it was captured (./node.ts) — which has no other spelling in
 * this grammar, since a span with both ends open is refused.
 */
test("`has:` on a stamp is that operator unbounded, and the pair is sayable", () => {
  expect(selects("has:created")).toEqual(["basil", "order", "install", "hinges"])
  expect(selects("has:changed")).toEqual(["basil", "order", "hinges"])
  expect(selects("has:created -has:changed")).toEqual(["install"])
  // ...and the unbounded form agrees with the widest bounded one on every
  // node, which is the whole reason that row is not a plain field test.
  expect(selects("has:created")).toEqual(selects("created:2000..2100"))
})

/** They refuse in the grammar's own voice, and teach the same twelve words
 *  `date:` teaches — one sentence for the three, named by whichever of them
 *  the reader actually typed. */
test("a stamp refuses what a date refuses, in its own name", () => {
  const refused = refusalsOf("created:soon")
  expect(refused?.map((one) => one.token)).toEqual(["created:soon"])
  expect(refused?.[0]?.reason).toContain("created: takes a day, month or year")
  expect(refused?.[0]?.reason).toContain("last-")
  expect(refusalsOf("changed:2026-13")).toHaveLength(1)
  expect(refusalsOf("changed:..")).toHaveLength(1)
  expect(refusalsOf("created:")?.[0]?.reason).toContain("no value")
})

/** A stamp clause reads a RECORD, so it answers about a node wherever it was
 *  filed — which is what makes `is:trashed created:2026-06` a question with
 *  an answer, exactly as it is for `date:`. */
test("a stamp reaches what was put away, when the query asks for it", () => {
  expect(selects("created:2026-06")).toEqual([])
  expect(selects("is:trashed created:2026-06")).toEqual(["gone"])
})

/** ...and they compose and negate like every other clause. */
test("a stamp composes with words, marks and the joiner", () => {
  expect(selects("cabinets created:this-week")).toEqual(["install"])
  expect(selects("created:today OR created:2025")).toEqual(["basil", "install"])
  expect(selects("has:created -changed:this-week")).toEqual(["install"])
})

// ── the durations ──────────────────────────────────────────────────────

/**
 * THE MOMENT `now` IS, for the tests that ask about durations — the same
 * {@link TODAY} with a clock face on it, so every day-word boundary above is
 * still the one being counted from and only the precision has changed.
 *
 * ELEVEN IN THE MORNING, deliberately: `order` was last written at 10:02 and
 * `install` was captured at 08:00 on the same day, so an hour, two hours and
 * three hours back each land between a different pair of them. A round number
 * would have put a boundary on top of a stamp everywhere rather than once,
 * where a bound landing exactly on a stamp is a case worth asking about on
 * purpose ({@link "a bound falls where the clock says, to the minute"}).
 */
const NOW = `${TODAY}T11:00:00-04:00`

/**
 * A BARE DURATION IS THE RANGE IT OPENS — `changed:1h` is `changed:1h..`,
 * within the last hour — which is the reading somebody's fingers assume and
 * the one every system with this value kind has (roadmap `duration-values`).
 *
 * The pair below is the whole of the sugar: the two spellings select the same
 * nodes, and they are not the same nodes as the point reading of that moment.
 */
test("a bare duration is within the last N, which is the range it opens", () => {
  expect(selects("changed:1h", NOW)).toEqual(["order"])
  expect(selects("changed:1h..", NOW)).toEqual(selects("changed:1h", NOW))
  // ...and half an hour back reaches nothing, because 10:02 is not inside it.
  expect(selects("changed:30m", NOW)).toEqual([])
})

/** A DURATION AT A RANGE'S END IS THE POINT `now` MINUS IT, and the two ends
 *  partition what the operator can see: what changed inside the hour and what
 *  changed before it are the two halves of `has:changed`. */
test("a duration as a range end is the moment, and the ends partition", () => {
  expect(selects("changed:..1h", NOW)).toEqual(["basil", "hinges"])
  expect(selects("changed:1h", NOW)).toEqual(["order"])
  expect(selects("has:changed", NOW)).toEqual(["basil", "order", "hinges"])
})

/** Both ends at once is a WINDOW, and it reads in the order a person says it:
 *  `2h..30m` is "between two hours and half an hour ago", the older bound
 *  first because that is the low end of the span. */
test("two durations are a window", () => {
  expect(selects("changed:2h..30m", NOW)).toEqual(["order"])
  // A window that closes before the node was written finds nothing…
  expect(selects("changed:2h..1h", NOW)).toEqual([])
  // …and one that opens after it does not reach back to it either.
  expect(selects("changed:30m..", NOW)).toEqual([])
})

/** THE ENDS MIX FREELY WITH THE DAY WORDS, because a duration is read by the
 *  same {@link meaningOf} the words are and a range takes each end's own reading:
 *  `created:yesterday..3h` is a day at one end and a clock face at the other,
 *  and the clause holds one of each. */
test("a duration and a day word are two ends of one range", () => {
  expect(selects("created:yesterday..3h", NOW)).toEqual(["install"])
  expect(selects("created:2026-08-01..3h", NOW)).toEqual(["order", "install"])
  expect(selects("changed:last-week..30m", NOW)).toEqual(["basil", "order", "hinges"])
})

/**
 * BOTH ENDS STAY INCLUSIVE at the new precision, which is the one case the
 * comparison has to answer specially — a value that IS the bound and carries
 * more after it is the longer string, and a longer string is the greater one.
 *
 * `install` was captured at 08:00:00 on the 13th. Three hours before eleven is
 * that same second, so it is inside `created:3h` (the low end) AND inside
 * `created:..3h` (the high end) — a node on the boundary belongs to both
 * halves, exactly as `date:2026-08-13..` and `date:..2026-08-13` both hold of
 * a node dated that day.
 */
test("a value sitting exactly on a bound is inside it, from either side", () => {
  expect(selects("created:3h", NOW)).toContain("install")
  expect(selects("created:..3h", NOW)).toContain("install")
})

/** A bound is the moment the clock said minus the units, to the minute and
 *  with the seconds it was carrying — so a stamp landing exactly on one is
 *  INSIDE, as both ends of every other span in this grammar are inclusive. */
test("a bound falls where the clock says, to the minute", () => {
  // `install` was captured at 08:00:00, which is exactly three hours before.
  expect(selects("created:3h", NOW)).toEqual(["install"])
  expect(selects("created:..3h", NOW)).toContain("install")
  // ...and two hours back is past it.
  expect(selects("created:2h", NOW)).toEqual([])
})

/** Every unit, and the arithmetic behind each — one query per row of the
 *  table, so a unit whose minutes were wrong is a failing line rather than a
 *  value nobody asked about. */
test("the four units count minutes, hours, days and weeks", () => {
  // `order` was written at 10:02, which is 58 minutes before eleven — so the
  // minute unit is countable one minute either side of that and the number is
  // minutes rather than anything else.
  expect(selects("changed:57m", NOW)).toEqual([])
  expect(selects("changed:58m", NOW)).toEqual(["order"])
  // ...and sixty of them is what the hour is worth, which is the table's own
  // claim asked end to end rather than restated.
  expect(selects("changed:60m", NOW)).toEqual(selects("changed:1h", NOW))
  // `hinges` was written at 09:00 on the 11th, so two rolling days from
  // eleven on the 13th stops just short of it and three reach it.
  expect(selects("changed:2d", NOW)).toEqual(["order"])
  expect(selects("changed:3d", NOW)).toEqual(["order", "hinges"])
  expect(selects("changed:1w", NOW)).toEqual(["basil", "order", "hinges"])
})

/** The count is a NUMBER, so more than one digit and a leading zero are the
 *  same number they are anywhere else. */
test("a duration's count is read as a number", () => {
  expect(selects("changed:90m", NOW)).toEqual(["order"])
  expect(selects("changed:01h", NOW)).toEqual(selects("changed:1h", NOW))
  // Folded like every other operator value, so a shift key changes nothing.
  expect(selects("changed:1H", NOW)).toEqual(selects("changed:1h", NOW))
  // Zero is a legal count and names the moment the question was asked. It
  // selects almost nothing and is refused by nothing — the same stance
  // `date:2026-02-30` is accepted under.
  expect(parseFilter("changed:0h", NOW).kind).toBe("asking")
  expect(selects("changed:0h", NOW)).toEqual([])
})

/**
 * ...AND A ZERO COUNT IS STILL A BOUND, which the empty answer above cannot
 * show: `0m` names the moment the question was asked, and a stamp ON that
 * moment is inside it, because a bare duration's low end is inclusive like
 * every other bound in this grammar.
 *
 * Asked of a corpus built for it, since the one above happens to hold nothing
 * stamped at exactly {@link NOW} — an empty answer that is empty for want of a
 * row proves nothing about the bound (grok, reviewing the durations).
 */
const ON_THE_DOT = {
  "dot.olai": [
    `{"id":"now","ord":"a0","title":"stamped at the moment asked","created":"${NOW}"}`,
    `{"id":"minute","ord":"a1","title":"stamped a minute before","created":"2026-08-13T10:59:00-04:00"}`,
  ].join("\n"),
}

const onTheDot = derive(nodesOfFiles(ON_THE_DOT))

test("a zero count is the moment asked, and a stamp on it is inside", () => {
  expect(selectsIn(onTheDot, "created:0m", NOW)).toEqual(["now"])
  expect(selectsIn(onTheDot, "created:0h", NOW)).toEqual(["now"])
  // ...and a minute earlier is outside a window of no width at all.
  expect(selectsIn(onTheDot, "created:1m", NOW)).toEqual(["now", "minute"])
  // The point reading of the same moment keeps it, both ends being inclusive.
  expect(selectsIn(onTheDot, "created:..0m", NOW)).toEqual(["now", "minute"])
})

/**
 * AN INVERTED WINDOW IS EMPTY, and it is the grammar's existing law rather
 * than a rule durations needed: `changed:30m..2h` reads left-to-right as every
 * range does, so its low end is the RECENT moment and its high end the older
 * one, and no date is both at once.
 *
 * The right way round is `changed:2h..30m` — older bound first, because a
 * range runs low to high and further back in time is lower. Worth pinning
 * because a duration is the one value where "first" reads as "nearest" to a
 * person typing it, so the wrong order is the plausible mistake; it is the
 * same empty answer `date:2026-08-14..2026-08-10` gives, and is deliberately
 * NOT refused — nothing here computes whether a span can hold anything, which
 * is the stance `date:2026-02-30` is accepted under.
 */
test("a window written backwards is empty, as an inverted day range is", () => {
  expect(selects("changed:2h..30m", NOW)).toEqual(["order"])
  expect(parseFilter("changed:30m..2h", NOW).kind).toBe("asking")
  expect(selects("changed:30m..2h", NOW)).toEqual([])
  // The same shape written in days, which is where the reading comes from.
  expect(selects("changed:2026-08-14..2026-08-10", NOW)).toEqual([])
})

/**
 * WHERE THE PREFIX SALVAGE STOPS, pinned rather than only described.
 *
 * {@link within} compares text and reads each bound at its own width, which is
 * exact for every value this package MINTS (`./stamp.ts`: `T`, seconds, a
 * numeric offset, no fraction). Two shapes `isIsoInstant` also allows put their
 * extra precision somewhere the comparison cannot salvage, and a value of
 * either sitting on a bound's exact instant falls outside it.
 *
 * ASSERTED BECAUSE IT IS A LIMIT, not because it is wanted: a test that pins
 * the boundary is what stops somebody "fixing" the comparison by accident, and
 * what makes the day it becomes worth fixing a visible change rather than a
 * silent one. Both need a datetime typed into a file by hand.
 */
const BY_HAND = {
  "hand.olai": [
    // The same instant as `install`'s capture, written three ways.
    `{"id":"plain","ord":"a0","title":"as this package writes one","created":"2026-08-13T08:00:00-04:00"}`,
    `{"id":"fraction","ord":"a1","title":"with a fraction nobody minted","created":"2026-08-13T08:00:00.000-04:00"}`,
    `{"id":"coarse","ord":"a2","title":"with the seconds left off","created":"2026-08-13T08:00-04:00"}`,
  ].join("\n"),
}

const byHand = derive(nodesOfFiles(BY_HAND))

test("a hand-written instant on a bound is outside it, and that is the limit", () => {
  // Three ways of writing 08:00:00 on the 13th, and three hours before eleven
  // is exactly that. The one this package mints is inside both ends.
  expect(selectsIn(byHand, "created:3h", NOW)).toContain("plain")
  expect(selectsIn(byHand, "created:..3h", NOW)).toContain("plain")
  // A FRACTION lands before the offset, so it is past the upper bound...
  expect(selectsIn(byHand, "created:..3h", NOW)).not.toContain("fraction")
  expect(selectsIn(byHand, "created:3h", NOW)).toContain("fraction")
  // ...and SECONDS LEFT OFF make the value shorter than the bound, so it falls
  // before the lower one.
  expect(selectsIn(byHand, "created:3h", NOW)).not.toContain("coarse")
  expect(selectsIn(byHand, "created:..3h", NOW)).toContain("coarse")
  // Neither is lost to the operator, which is what keeps this a precision
  // limit rather than a node the grammar cannot reach.
  expect(selectsIn(byHand, "has:created", NOW)).toEqual(["plain", "fraction", "coarse"])
})

/** …and they negate and compose like every other clause. */
test("a duration composes with words, marks and the joiner", () => {
  expect(selects("cabinets changed:1h", NOW)).toEqual(["order"])
  expect(selects("is:doing changed:1h", NOW)).toEqual(["order"])
  expect(selects("changed:1h OR created:3h", NOW)).toEqual(["order", "install"])
  // "untouched for a day" — which reaches the unstamped too, on the existing
  // reading that a clause with nothing to read cannot hold.
  expect(selects("-changed:1d", NOW)).not.toContain("order")
  expect(selects("-changed:1d", NOW)).toContain("hinges")
})

/**
 * A ROLLING WINDOW IS NOT A CALENDAR ONE, which is the distinction the two
 * families of value exist to keep: `1d` is the last twenty-four hours and
 * `today` is since midnight; `1w` is the last seven days and `this-week` is
 * since Monday. The corpus is built to make each pair disagree, because a
 * corpus where they agreed would pin nothing.
 */
const ROLLING = {
  "rolling.olai": [
    // Since midnight, and so inside both readings of a day.
    `{"id":"morning","ord":"a0","title":"this morning","created":"2026-08-13T08:00:00-04:00"}`,
    // Yesterday evening: inside a rolling day, outside today.
    `{"id":"evening","ord":"a1","title":"last night","created":"2026-08-12T22:00:00-04:00"}`,
    // Yesterday morning: outside both.
    `{"id":"breakfast","ord":"a2","title":"yesterday early","created":"2026-08-12T07:00:00-04:00"}`,
    // The Sunday before: inside a rolling week, outside a Monday-anchored one.
    `{"id":"sunday","ord":"a3","title":"the weekend","changed":"2026-08-09T12:00:00-04:00"}`,
    // The Monday: inside both.
    `{"id":"monday","ord":"a4","title":"start of the week","changed":"2026-08-10T12:00:00-04:00"}`,
    // The Wednesday before: outside both.
    `{"id":"older","ord":"a5","title":"the week before","changed":"2026-08-05T12:00:00-04:00"}`,
  ].join("\n"),
}

const rolling = derive(nodesOfFiles(ROLLING))

test("`1d` is a rolling day where `today` is since midnight", () => {
  expect(selectsIn(rolling, "created:1d", NOW)).toEqual(["morning", "evening"])
  expect(selectsIn(rolling, "created:today", NOW)).toEqual(["morning"])
})

test("`1w` is a rolling week where `this-week` starts on Monday", () => {
  // TODAY is a Thursday, so its week began on the 10th and a rolling week
  // reaches back to the 6th.
  expect(selectsIn(rolling, "changed:1w", NOW)).toEqual(["sunday", "monday"])
  expect(selectsIn(rolling, "changed:this-week", NOW)).toEqual(["monday"])
})

/**
 * A DAY-GRANULAR VALUE COMPARES AT ITS OWN PRECISION, which is the one
 * consequence of this value kind that had to be RULED rather than derived: a
 * `date:` field holding a bare day sorts before every moment on that day —
 * "the start of it", which is what ten characters say — so `date:1h`
 * effectively asks about done-instants and not about the day's plans.
 *
 * The other half of that sentence is the honest one: the bare form is a range
 * open ABOVE, so a day still to come is inside it, exactly as it is inside
 * `date:today..`. Stated rather than special-cased (docs/search.md).
 */
const JOURNAL = {
  "journal.olai": [
    `{"id":"ticked","ord":"a0","title":"just ticked","done":"2026-08-13T10:40:00-04:00"}`,
    `{"id":"earlier","ord":"a1","title":"ticked at breakfast","done":"2026-08-13T07:00:00-04:00"}`,
    `{"id":"planned","ord":"a2","title":"planned for today","date":"2026-08-13"}`,
    `{"id":"soon","ord":"a3","title":"planned for tomorrow","date":"2026-08-14"}`,
  ].join("\n"),
}

const journal = derive(nodesOfFiles(JOURNAL))

test("`date:1h` reaches the done-instants, and the day's plans sit before it", () => {
  expect(selectsIn(journal, "date:1h", NOW)).toEqual(["ticked", "soon"])
  // Where the day-granular question answers with everything on the 13th, the
  // day's plan included — which is the difference being pinned.
  expect(selectsIn(journal, "date:today", NOW)).toEqual(["ticked", "earlier", "planned"])
  // ...and the point reading is the other side of the same moment: the two
  // ends partition the journal, and the day's plan sorts with what is older.
  expect(selectsIn(journal, "date:..1h", NOW)).toEqual(["earlier", "planned"])
})

/**
 * WHAT IS NOT A DURATION IS REFUSED, in the operator's own words and never
 * searched for as text — the grammar's standing contract, extended to a value
 * kind whose near misses are the ones a reader will actually type.
 *
 * `1mo` and `1y` are the two the ruling costs, and the refusal has to say so:
 * the `m` collision was decided in favour of minutes, month and year recency is
 * already sayable in words, and a reader who is not told that tries `1M`,
 * `1mon` and `1month` in turn.
 */
test("a value that is not a duration is refused, with the units spelled out", () => {
  for (const value of ["1mo", "1y", "1month", "1q", "1s", "1h30m", "h", "1", "1h!"]) {
    const refused = refusalsOf(`created:${value}`, NOW)
    expect(refused?.map((one) => one.token)).toEqual([`created:${value}`])
  }
  // `1M` is NOT among them, and that is the case-folding law meeting the
  // ruling rather than a hole in it: every operator value in this grammar is
  // folded (`is:DONE` works), so a capital `M` is the minute unit. Somebody
  // who typed it meaning a month gets a minute — which is the collision the
  // ruling decided in minutes' favour, said in the one place it can still
  // surprise. The refusal above is what teaches them the units are four.
  expect(selects("changed:1M", NOW)).toEqual(selects("changed:1m", NOW))
  const taught = refusalsOf("created:1mo", NOW)?.[0]?.reason
  expect(taught).toContain("created: takes a day, month or year")
  expect(taught).toContain("1m = 1 minute")
  expect(taught).toContain("1w = 1 week")
  expect(taught).toContain("no month or year units")
  // ...and the sugar is taught beside the units, since it is the reading a
  // bare one gets.
  expect(taught).toContain("1h is 1h..")
})

/** A count no calendar can be walked through is refused on the same terms a
 *  `date:2026-13` is: the shape is clean, the value is impossible, and an
 *  empty answer with no reason is the silent error the refusals exist for. */
test("a duration that walks off the calendar is refused, not answered emptily", () => {
  expect(refusalsOf("created:999999w", NOW)).toHaveLength(1)
  // Seven digits is past the shape itself, which is the cheap half of the
  // same bound: the count is multiplied into minutes and handed to a walk.
  expect(refusalsOf("created:1234567h", NOW)).toHaveLength(1)
  // ...and what a person actually types is answered.
  expect(parseFilter("created:999999m", NOW).kind).toBe("asking")
})

/** A duration is refused at all three day operators in one sentence, named by
 *  whichever the reader typed — the rule the value grammar has always had,
 *  and the reason a new value kind reaches three doors at once. */
test("the three day operators refuse a duration in the same words", () => {
  for (const name of ["date", "created", "changed"]) {
    expect(refusalsOf(`${name}:1y`, NOW)?.[0]?.reason).toContain(
      `${name}: takes a day, month or year`,
    )
    expect(refusalsOf(`${name}:1y`, NOW)?.[0]?.reason).toContain("no month or year units")
  }
})

/** THE CLOCK IS STILL AN ARGUMENT, and a duration counts from the whole of it
 *  where a day word counts from the ten characters in front. A clock naming
 *  only a day names midnight on it, which is what the browser's own parse of
 *  its filter box hands over — and the reason that parse's bounds are not what
 *  anything is selected by (`@olai/web`'s `pane/PageView.tsx`). */
test("a duration counts from the moment the clock names", () => {
  expect(selects("changed:1h", `${TODAY}T10:30:00-04:00`)).toEqual(["order"])
  // Half an hour earlier on the same day, and 10:02 has fallen out of the hour.
  expect(selects("changed:1h", `${TODAY}T11:30:00-04:00`)).toEqual([])
  // A clock that names only a day is midnight on it, so an hour back is the
  // evening before — a legal parse over a bound nothing here selects by.
  expect(parseFilter("changed:1h", TODAY).kind).toBe("asking")
})

// ── the archive ────────────────────────────────────────────────────────

test("what was put away stays put away until it is asked for", () => {
  // `gone` carries `#home` and the word `kitchen`, and answers neither.
  expect(selects("#home")).not.toContain("gone")
  expect(selects("kitchen")).toEqual(["kitchen"])
  expect(selects("is:trashed")).toEqual(["gone"])
  expect(selects("#home is:trashed")).toEqual(["gone"])
  // Saying it out loud is the same default said out loud.
  expect(selects("#home -is:trashed")).toEqual(["herbs", "kitchen", "hinges"])
})

/**
 * ...unless the caller's scope IS what was put away, which is the one door that
 * says so: the filter over a page whose rows are archived ones — the trash, or
 * a zoom onto an archived node (ruled 2026-08-17 — a day and the agenda drew
 * them until then). The default is a rule about searching a DIRECTORY; such a
 * page has decided already, and a matcher overruling it takes every row off a
 * screen with nothing to read the absence by.
 */
test("a scope that is already the archive is answered rather than overruled", () => {
  const home = parseFilter("#home", TODAY)
  expect(matching(derived, home, { trashed: true }).map(({ at }) => at.node.id))
    .toEqual(["gone", "herbs", "kitchen", "hinges"])
  // The operator goes on meaning what it means there — and its negation still
  // takes what was put away back out.
  const archived = parseFilter("#home is:trashed", TODAY)
  expect(matching(derived, archived, { trashed: true }).map(({ at }) => at.node.id))
    .toEqual(["gone"])
  const live = parseFilter("#home -is:trashed", TODAY)
  expect(matching(derived, live, { trashed: true }).map(({ at }) => at.node.id))
    .toEqual(["herbs", "kitchen", "hinges"])
  // And it composes with the other two scopes rather than replacing them.
  expect(
    matching(derived, home, { trashed: true, file: "_olai/Trash.olai" })
      .map(({ at }) => at.node.id),
  ).toEqual(["gone"])
})

// Leftover Archive.olai is orphaned from every query, including `is:trashed`
// (human, 2026-08-19: left on disk and stop being read). It is not trash, and
// it is not live work either.
test("a leftover Archive.olai is in no query, including is:trashed", () => {
  const leftover = derive(nodesOfFiles({
    "house.olai":
      `{"id":"live","ord":"a0","title":"live leftover work","todo":true,"date":"2026-08-11"}`,
    "Archive.olai":
      `{"id":"old","ord":"a0","title":"put away leftover","todo":true,"date":"2026-08-11"}`,
    "notes/Archive.olai":
      `{"id":"older","ord":"a0","title":"nested leftover"}`,
  }))
  expect(selectsIn(leftover, "leftover")).toEqual(["live"])
  expect(selectsIn(leftover, "is:trashed")).toEqual([])
  expect(selectsIn(leftover, "is:todo")).toEqual(["live"])
  expect(selectsIn(leftover, "date:2026-08-11")).toEqual(["live"])
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

/**
 * IN THE ORDER THE QUERY NAMED THEM, which is what a row draws its matched keys
 * in (`@olai/web`'s `search/props.ts`) and which is NOT the order they are
 * tested in: a `prop:` sharing a group with a word is tested last, because the
 * groups holding no word go first. The clauses are collected where the tokens
 * are read, so the reader's order survives the evaluation order.
 */
test("the keys are named in the order the query named them, not the order they are tested in", () => {
  expect(propsOf("prop:agent prop:pr")).toEqual(["agent", "pr"])
  expect(propsOf("prop:agent OR cabinets prop:pr")).toEqual(["agent", "pr"])
  expect(propsOf("prop:pr OR cabinets prop:agent")).toEqual(["pr", "agent"])
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

// ── the day, narrowed ──────────────────────────────────────────────────
//
// The other shape a filtered page can be, and the one that needs no ancestors
// kept: a day's rows are flat and each already carries the trail that says what
// it is about, so a filter over one is exactly the rows that matched.

/** What a day draws, as `file/id` per row — the same pair a day's own `<Key>`
 *  is built on, because a day crosses files and an id alone would not say
 *  which one a row came from. */
const listed = (groups: ReadonlyArray<DayGroup>): ReadonlyArray<string> =>
  groups.flatMap((group) =>
    group.nodes.map((one) => `${group.file}/${one.shows.node.id}`)
  )

const onDay = (day: string): ReadonlyArray<DayGroup> => datedOn(derived, day)

/** The ids a query selects for a DAY's filter — no archive scope, because a day
 *  draws none of it (./dates.ts). */
const idsOf = (text: string): ReadonlySet<string> =>
  new Set(matching(derived, parseFilter(text, TODAY)).map(({ at }) => at.node.id))

test("a filtered day keeps what matched and nothing as context", () => {
  const tenth = onDay("2026-08-10")
  expect(listed(tenth)).toEqual(["house.olai/order"])
  expect(listed(keepingDated(tenth, idsOf("cabinets")))).toEqual([
    "house.olai/order",
  ])
  // The node's ANCESTORS are not on the day and are not put there by matching
  // one of them: `kitchen` is the crumb above the row, not a row.
  expect(listed(keepingDated(tenth, idsOf("kitchen remodel")))).toEqual([])
})

test("an outline with nothing left is not a heading over no rows", () => {
  const tenth = onDay("2026-08-10")
  expect(tenth.map((group) => group.file)).toEqual(["house.olai"])
  expect(keepingDated(tenth, idsOf("nothing-is-called-this"))).toEqual([])
})

// The two halves of the 2026-08-17 ruling, side by side: `gone` was finished on
// the 1st of June and then put away, so the day it happened on draws nothing —
// and the operator that names the archive still answers with it, from any door.
test("a day draws none of the archive, and `is:trashed` still reaches it", () => {
  expect(onDay("2026-06-01")).toEqual([])
  expect(selects("is:trashed")).toEqual(["gone"])
})

// ...and the CONJUNCTION, which is the sentence docs/search.md actually makes
// and the one neither half above can hold on its own. `date:` reads a record's
// own dates (`datesOf`) where a day page reads the walk that drops the archive,
// so the two clauses compose: `is:trashed` opens the reading and `date:` finds
// the day inside it. Pinned because the obvious "tidy-up" — gating `datesOf` on
// the file the record sits in — kills this query while every test above stays
// green.
test("`is:trashed` and `date:` compose over a day the page itself draws empty", () => {
  expect(selects("is:trashed date:2026-06-01")).toEqual(["gone"])
  // Without the operator the same day selects nothing: the archive is out of
  // the reading, not out of the record.
  expect(selects("date:2026-06-01")).toEqual([])
})

// ── the order ──────────────────────────────────────────────────────────
//
// The rest of the score {@link matchOf} starts — a finished node loses about a
// field — which two doors need (`search_nodes` and the chat composer's `@`) and
// neither may respell (`ranked`'s own header). The CAP is each door's own, so
// these ask for the order and take what they want off the top.

/** The ids a query's best few name, best first. */
const bestOf = (text: string, limit: number): ReadonlyArray<string> =>
  ranked(derived, matching(derived, parseFilter(text, TODAY)))
    .slice(0, limit)
    .map(({ at }) => at.node.id)

test("the shortlist is ranked, where the answer it is cut from is not", () => {
  // `the` opens `the herb bed` and is buried in five other titles, so one node
  // outranks the rest by the position bonus alone — and it is not the one the
  // set lists first (`basil` is, in the file that sorts before `house.olai`).
  expect(matching(derived, parseFilter("the", TODAY)).map(({ at }) => at.node.id))
    .toEqual(["herbs", "basil", "demo", "order", "install", "hinges"])
  expect(bestOf("the", 3)).toEqual(["herbs", "order", "install"])
})

test("a finished node loses ties without losing its place in the list", () => {
  // `basil` and `demo` carry the same buried `the` as three live nodes and are
  // both done, so the penalty puts them under all three — and neither is
  // dropped: the reason to look for a node you finished is usually that you
  // finished it.
  expect(bestOf("the", 8))
    .toEqual(["herbs", "order", "install", "hinges", "basil", "demo"])
})

test("the cap is a cap, and ties keep the set's own order", () => {
  // Three tags of equal weight in three different files: the answer is the
  // set's own order, because the sort is stable over a list already in it.
  expect(bestOf("#home", 8)).toEqual(["herbs", "kitchen", "hinges"])
  expect(bestOf("#home", 2)).toEqual(["herbs", "kitchen"])
  expect(bestOf("#home", 0)).toEqual([])
})

// The archive rule is the MATCHER's, and a shortlist inherits it rather than
// re-deciding it — which is what lets a door offer the best few without
// writing an archive rule of its own (`@olai/web`'s `chat/nodes.ts`).
test("what was put away is out of a shortlist too, unless the query says so", () => {
  // `the old kitchen table` is in the archive, so the word alone does not
  // reach it — and the operator, which SELECTS what was put away rather than
  // widening the reading, answers with it alone.
  expect(bestOf("kitchen", 8)).toEqual(["kitchen"])
  expect(bestOf("kitchen is:trashed", 8)).toEqual(["gone"])
})

test("a query the grammar refuses, and an empty one, have no shortlist", () => {
  expect(bestOf("is:open", 8)).toEqual([])
  expect(bestOf("", 8)).toEqual([])
})

test("how many rows a day draws is how many entries it holds, not how many files", () => {
  const third = onDay("2026-08-03")
  expect(third.map((group) => group.file)).toEqual(["house.olai"])
  expect(datedIn(third)).toBe(1)
  expect(datedIn(onDay("2026-08-10"))).toBe(1)
  expect(datedIn([])).toBe(0)
})

// ── where the words landed ─────────────────────────────────────────────
//
// The half of a query a ROW needs and the matcher never had to answer: not
// "does this node hold the words" but "where in this text are they", so a
// filtered page can say why each row is in front of the reader.

/** The needles of a query, as the matcher folded them. */
const needles = (text: string): ReadonlyArray<string> => needlesFrom(text, TODAY)

/** A text with its lit runs marked, which is what a highlight IS — written
 *  this way so a failure reads as the sentence somebody would see. */
const lit = (text: string, query: string): string => {
  const runs = litBy(text, needles(query))
  let out = ""
  let at = 0
  for (const run of runs) {
    out += `${text.slice(at, run.at)}[${text.slice(run.at, run.end)}]`
    at = run.end
  }
  return out + text.slice(at)
}

test("the needles are the query's positive words, folded and deduped", () => {
  expect(needles("Cabinets")).toEqual(["cabinets"])
  expect(needles("pick pick the")).toEqual(["pick", "the"])
  expect(needles('"pick the hinges"')).toEqual(["pick the hinges"])
  expect(needles("handles OR knobs")).toEqual(["handles", "knobs"])
})

test("a word the query took BACK OUT is not a reason, so it is not a needle", () => {
  // A node kept by `-walnut` is not here because of walnut, and lighting the
  // one word the reader said they did not want would be the row drawing a lie.
  expect(needles("cabinets -walnut")).toEqual(["cabinets"])
  expect(needles("-walnut")).toEqual([])
})

test("a query with no words in it has no needles at all", () => {
  // `is:done` selects on a mark, and a mark is not text in a title — so there
  // is nothing to light, and saying "title" would be inventing an answer.
  expect(needles("is:done")).toEqual([])
  expect(needles("date:2026-08-10 prop:pr")).toEqual([])
  expect(needles("")).toEqual([])
  expect(needles("is:open")).toEqual([])
})

test("a needle lands wherever the fold finds it, whatever case it was written in", () => {
  // The SAME fold `matching` uses — so a highlight cannot appear in a stretch
  // of text the matcher never looked at.
  expect(lit("order the cabinets", "cabinets")).toBe("order the [cabinets]")
  expect(lit("Order the Cabinets", "CABINETS")).toBe("Order the [Cabinets]")
  expect(lit("pick the hinges", "the")).toBe("pick [the] hinges")
})

test("every occurrence is lit, not only the first", () => {
  expect(lit("pick the hinges, pick the knobs", "pick")).toBe(
    "[pick] the hinges, [pick] the knobs",
  )
})

test("a phrase is one landing where two words are two", () => {
  expect(lit("pick the hinges", '"pick the"')).toBe("[pick the] hinges")
  expect(lit("pick the hinges", "pick the")).toBe("[pick] [the] hinges")
})

test("two needles on the same stretch are one run, never one inside another", () => {
  // Without the merge, `pick` would be lit twice — once alone and once inside
  // the phrase — and every caller would have to undo it.
  expect(lit("pick the hinges", 'pick "pick the"')).toBe("[pick the] hinges")
  expect(lit("cabinets", "cabinet cabinets")).toBe("[cabinets]")
})

test("a text the query is not in has no runs, and neither has an empty query", () => {
  expect(litBy("order the cabinets", needles("walnut"))).toEqual([])
  expect(litBy("order the cabinets", needles("is:done"))).toEqual([])
  expect(litBy("", needles("cabinets"))).toEqual([])
})

test("a tag is lit as the text it is, sigil and all or bare", () => {
  // Both spellings find it — the fold indexes a tag twice — and each lights
  // exactly what it asked for.
  expect(lit("kitchen remodel #home", "#home")).toBe("kitchen remodel [#home]")
  expect(lit("kitchen remodel #home", "home")).toBe("kitchen remodel #[home]")
})

test("a fold that changes length is mapped back onto what was written", () => {
  // `İ` lowercases to two units, so an offset in the fold is not an offset in
  // the source — and a highlight placed by the fold's own arithmetic would sit
  // one character to the left of the word for the rest of the line.
  expect(lit("İstanbul cabinets", "cabinets")).toBe("İstanbul [cabinets]")
  expect(lit("aİb cabinets", "cabinets")).toBe("aİb [cabinets]")
})

test("a needle landing INSIDE such a character lights the whole of it", () => {
  // The half the two above do not reach: they pin an ASCII needle AFTER the
  // `İ`, where the map is only shifting an offset. `i` is a hit on the FIRST
  // of that character's two fold units, and there is no half a character to
  // light — a map that sent both ends to the character's start answered with an
  // empty span, which the view draws as a highlight of nothing beside a letter
  // the reader can see (grok, #240).
  expect(lit("İstanbul", "i")).toBe("[İ]stanbul")
  expect(lit("aİb", "i")).toBe("a[İ]b")
  // The combining dot is the second unit, and asking for both is the same
  // character rather than a wider run.
  expect(lit("İstanbul", "i\u0307")).toBe("[İ]stanbul")
  // ...and a needle that reaches THROUGH it takes what follows with it.
  expect(lit("İstanbul", "i\u0307st")).toBe("[İst]anbul")
  // A run that ends inside one is rounded out the same way, from the other
  // side: `ai` covers the `a` and the first unit of `İ`.
  expect(lit("aİb", "ai")).toBe("[aİ]b")
})

test("no run a needle produces is ever empty, whatever the fold did", () => {
  // The property the two-table map buys, asserted as a property rather than
  // left to the view to elide: an empty `<mark>` is a 2px smudge where the
  // reader typed a letter.
  for (const text of ["İstanbul", "aİb", "İİ", "ﬁle", "ǅungla", "plain"]) {
    for (const needle of ["i", "i\u0307", "a", "l", "ǆ", "ﬁ"]) {
      for (const one of litBy(text, [needle])) {
        expect(one.end, `${text} / ${needle}`).toBeGreaterThan(one.at)
        expect(text.slice(one.at, one.end), `${text} / ${needle}`).not.toBe("")
      }
    }
  }
})
