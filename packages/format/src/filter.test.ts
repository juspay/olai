import { expect, test } from "bun:test"

import { datedIn, datedOn, type DayGroup } from "./dates.ts"
import { derive, type Derived, type Row, rowsOf } from "./derive.ts"
import {
  keeping,
  keepingDated,
  matchedIn,
  matching,
  parseFilter,
  type Refusal,
  relativeSpan,
  shownRecord,
} from "./filter.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"

/** One corpus, standing in for a directory: marks, dates, notes, edges, tags,
 *  a mirror, an archive beside it — and a chain of `after` edges that crosses
 *  a file, so blockedness has something to be derived from. Every assertion
 *  below is about this. */
const CORPUS = {
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters","done":"2026-08-03"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"date":"2026-08-10","desc":"walnut or birch","after":["demo"],"see":["herbs"],"custom":{"agent":"Claude-Opus","pr":"https://github.com/juspay/olai/pull/176","tags":["cabinets","walnut"]}}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","doc":"finishes.md","after":["order"]}`,
    `{"id":"hinges","parent":"install","ord":"a0","title":"pick the hinges #home","todo":"2026-08-11","after":["order"]}`,
    `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
  ].join("\n"),
  "garden.olai": [
    `{"id":"garden","ord":"a0","title":"garden #outdoors"}`,
    `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed #home","doing":true,"after":["hinges"]}`,
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
    speaksOfArchive: false,
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
  expect(selects("is:archived OR nothing-is-called-this")).toEqual(["gone"])
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
 *  refusals exist only on the arm that has them. */
const refusalsOf = (text: string): ReadonlyArray<Refusal> | null => {
  const filter = parseFilter(text, TODAY)
  return filter.kind === "refused" ? filter.refusals : null
}

test("a known operator with an unknown value is refused, and teaches", () => {
  const refused = refusalsOf("is:open")
  expect(refused?.map((one) => one.token)).toEqual(["is:open"])
  expect(refused?.[0]?.reason).toContain("done, doing, todo, marked, blocked, archived")
  // Refused means it selects NOTHING — never "the half of the query I could
  // read", which is the silent error that would look like an answer. The union
  // is what makes that structural: a refused filter HAS no terms to fall back
  // on.
  expect(refusalsOf("is:open kitchen")).toHaveLength(1)
  expect(selects("is:open kitchen")).toEqual([])
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
  expect(matching(derived, home, { archived: true }).map(({ at }) => at.node.id))
    .toEqual(["gone", "herbs", "kitchen", "hinges"])
  // The operator goes on meaning what it means there — and its negation still
  // takes what was put away back out.
  const archived = parseFilter("#home is:archived", TODAY)
  expect(matching(derived, archived, { archived: true }).map(({ at }) => at.node.id))
    .toEqual(["gone"])
  const live = parseFilter("#home -is:archived", TODAY)
  expect(matching(derived, live, { archived: true }).map(({ at }) => at.node.id))
    .toEqual(["herbs", "kitchen", "hinges"])
  // And it composes with the other two scopes rather than replacing them.
  expect(
    matching(derived, home, { archived: true, file: "Archive.olai" })
      .map(({ at }) => at.node.id),
  ).toEqual(["gone"])
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
test("a day draws none of the archive, and `is:archived` still reaches it", () => {
  expect(onDay("2026-06-01")).toEqual([])
  expect(selects("is:archived")).toEqual(["gone"])
})

test("how many rows a day draws is how many entries it holds, not how many files", () => {
  const third = onDay("2026-08-03")
  expect(third.map((group) => group.file)).toEqual(["house.olai"])
  expect(datedIn(third)).toBe(1)
  expect(datedIn(onDay("2026-08-10"))).toBe(1)
  expect(datedIn([])).toBe(0)
})
