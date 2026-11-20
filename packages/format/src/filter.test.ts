import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { datedIn, datedOn, type DayGroup } from "./dates.ts"
import { derive, type Derived, type Row, rowsOf } from "./derive.ts"
import {
  insideSubtree,
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
import { nodesOfFiles, seeded } from "./fixtures.testlib.ts"
import { declarationsOf, NO_KINDS } from "./typing.ts"
import { isMirror, isPutAway } from "./node.ts"
const CORPUS = {
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters","done":"2026-08-03"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"date":"2026-08-10","repeat":"every week on monday","desc":"walnut or birch","after":["demo"],"see":["herbs"],"created":"2026-08-01T09:12:44-04:00","changed":"2026-08-13T10:02:00-04:00","custom":{"agent":"Claude-Opus","pr":"https://github.com/juspay/olai/pull/176","tags":["cabinets","walnut"]}}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","after":["order"],"created":"2026-08-13T08:00:00-04:00"}`,
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

const derived = derive(TEST_CLAIMS, nodesOfFiles(CORPUS))

const CALLED_OFF = derive(TEST_CLAIMS, nodesOfFiles({
  ...CORPUS,
  "house.olai": CORPUS["house.olai"]
    .replace(`"done":"2026-08-03"`, `"cancelled":"2026-08-03T11:00:00-04:00"`)
    .replace(`"doing":true,"date":"2026-08-10"`, `"cancelled":true,"date":"2026-08-10"`),
}))

const TODAY = "2026-08-13"

const selectsIn = (
  derivation: Derived,
  text: string,
  today = TODAY,
): ReadonlyArray<string> =>
  matching(derivation, parseFilter(text, today)).map(({ at }) => at.node.id)

const selects = (text: string, today = TODAY): ReadonlyArray<string> =>
  selectsIn(derived, text, today)

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
  expect(selects("home")).toEqual(["herbs", "kitchen", "hinges"])
  expect(selects("#outdoors")).toEqual(["garden"])
})

test("`is:` reads the mark the node STORES, never a derived one", () => {
  expect(selects("is:done")).toEqual(["basil", "demo"])
  expect(selects("is:doing")).toEqual(["herbs", "kitchen", "order"])
  expect(selects("is:todo")).toEqual(["hinges"])
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
  expect(selects("has:see")).toEqual(["order"])
  expect(selects("has:after")).toEqual(["herbs", "order", "install", "hinges"])
  expect(selects("has:repeat")).toEqual(["order"])
})

test("`has:repeat` is inside `has:date`, and the difference is what is dated once", () => {
  expect(selects("has:date")).toEqual(["basil", "demo", "order"])
  expect(selects("has:date -has:repeat")).toEqual(["basil", "demo"])
})

test("a field holding nothing is a field the record does not carry", () => {
  const hollow = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": [
      `{"id":"blank","ord":"a0","title":"blank","desc":"","see":[],"after":[]}`,
      `{"id":"real","ord":"a1","title":"real","desc":"something"}`,
    ].join("\n"),
  }))
  expect(selectsIn(hollow, "has:desc")).toEqual(["real"])
  expect(selectsIn(hollow, "has:see")).toEqual([])
  expect(selectsIn(hollow, "has:after")).toEqual([])
})

test("a hollow stamp is a stamp the record does not carry", () => {
  const at = (id: string, created: string, line: number) => ({
    file: "a.olai",
    line,
    node: { id, ord: `a${line}`, title: id, created },
  })
  const condemned = derive(TEST_CLAIMS, [
    at("blank", "", 1),
    at("real", "2026-08-01T09:00:00-04:00", 2),
  ])
  expect(selectsIn(condemned, "has:created")).toEqual(["real"])
  expect(selectsIn(condemned, "-has:created")).toEqual(["blank"])
  expect(selectsIn(condemned, "created:2000..2100")).toEqual(["real"])
})

test("`date:` reads the three dates a journal reads — scheduled, finished, called off", () => {
  expect(selects("date:2026-08-10")).toEqual(["order"])
  expect(selects("date:2026-08-03")).toEqual(["demo"])
  expect(selects("date:2026-08-01")).toEqual([])
  expect(selects("date:2026-08-11")).toEqual([])

  expect(selectsIn(CALLED_OFF, "date:2026-08-03")).toEqual(["demo"])
  expect(selectsIn(CALLED_OFF, "date:2026-08-10")).toEqual(["order"])
  expect(selectsIn(CALLED_OFF, "has:date")).toEqual(["basil", "demo", "order"])
  expect(selectsIn(CALLED_OFF, "date:2026-08-01")).toEqual([])
  expect(selectsIn(CALLED_OFF, "date:2026-08-11")).toEqual([])
})

test("`has:date` is the same walk `date:` reads, unbounded", () => {
  expect(selects("has:date")).toEqual(["basil", "demo", "order"])
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

test("a week runs Monday to Sunday, wherever in it the question is asked", () => {
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
  expect(relativeSpan("yesterday", "2026-01-01")?.from).toBe("2025-12-31")
  expect(relativeSpan("tomorrow", "2028-02-28")?.from).toBe("2028-02-29")
})

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
  expect(relativeSpan("today", "")).toBeNull()
  expect(relativeSpan("this-week", "2026-02-30")).toBeNull()
})

test("a word the prototype answers for is not a word this vocabulary holds", () => {
  for (const word of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
    expect(relativeSpan(word, TODAY)).toBeNull()
    expect(relativeSpan(`${word}-week`, TODAY)).toBeNull()
    expect(relativeSpan(`this-${word}`, TODAY)).toBeNull()
  }
  for (const token of ["date:constructor", "date:__proto__", "date:__proto__-week"]) {
    expect(refusalsOf(token)?.map((one) => one.token)).toEqual([token])
    expect(selects(token)).toEqual([])
  }
})

test("a relative word selects the days it names", () => {
  expect(selects("date:this-week")).toEqual(["order"])
  expect(selects("date:last-week")).toEqual(["demo"])
  expect(selects("date:next-week")).toEqual([])
  expect(selects("date:this-month")).toEqual(["demo", "order"])
  expect(selects("date:last-month")).toEqual(["basil"])
  expect(selects("date:this-year")).toEqual(["basil", "demo", "order"])
  expect(selects("date:THIS-MONTH")).toEqual(["demo", "order"])
  expect(selects("has:date -date:this-week")).toEqual(["basil", "demo"])
})

test("the day words count from the day the query is asked on", () => {
  expect(selects("date:today", "2026-08-10")).toEqual(["order"])
  expect(selects("date:yesterday", "2026-08-11")).toEqual(["order"])
  expect(selects("date:tomorrow", "2026-08-09")).toEqual(["order"])
  expect(selects("date:today", TODAY)).toEqual([])
})

test("a relative word composes with a range at either end", () => {
  expect(selects("date:last-week..")).toEqual(["demo", "order"])
  expect(selects("date:..last-week")).toEqual(["basil", "demo"])
  expect(selects("date:last-month..last-week")).toEqual(["basil", "demo"])
  expect(selects("date:2026-08-04..today")).toEqual(["order"])
  expect(refusalsOf("date:last-week..soonish")).toHaveLength(1)
  expect(refusalsOf("date:whenever..today")).toHaveLength(1)
})

test("a relative word the grammar does not know is refused, and names them all", () => {
  const refused = refusalsOf("date:tomorrowish")
  expect(refused?.map((one) => one.token)).toEqual(["date:tomorrowish"])
  expect(refused?.[0]?.reason).toContain("today, yesterday, tomorrow")
  expect(refused?.[0]?.reason).toContain("this- / last- / next- with week, month, year")
  for (const word of ["today", "yesterday", "tomorrow"]) {
    expect(relativeSpan(word, TODAY)).not.toBeNull()
  }
  for (const step of ["this", "last", "next"]) {
    for (const unit of ["week", "month", "year"]) {
      expect(relativeSpan(`${step}-${unit}`, TODAY)).not.toBeNull()
    }
  }
  expect(selects("date:tomorrowish")).toEqual([])
  expect(refusalsOf("Date:Tomorrowish")?.[0]?.token).toBe("Date:Tomorrowish")
})

test("`-` negates whichever kind of token it is in front of", () => {
  expect(selects("#home -is:done")).toEqual(["herbs", "kitchen", "hinges"])
  expect(selects("cabinets -is:doing")).toEqual(["install"])
  expect(selects("is:done -basil")).toEqual(["demo"])
  expect(parseFilter("-", TODAY).kind).toBe("asking")
  expect(selects("-")).toEqual([])
})

test("clauses and words compose", () => {
  expect(selects("#home is:todo")).toEqual(["hinges"])
  expect(selects("has:date is:doing")).toEqual(["order"])
})

test("a phrase is one substring, where the words are four", () => {
  expect(selects(`"the cabinets"`)).toEqual(["order", "install"])
  expect(selects(`"cabinets the"`)).toEqual([])
  expect(selects("cabinets the")).toEqual(["order", "install"])
  expect(selects(`"kitchen remodel"`)).toEqual(["kitchen"])
})

test("a phrase is folded and negated like any other word", () => {
  expect(selects(`"The Cabinets"`)).toEqual(["order", "install"])
  expect(selects(`#home -"kitchen remodel"`)).toEqual(["herbs", "hinges"])
  expect(parseFilter(`"-force"`, TODAY)).toEqual({
    kind: "asking",
    groups: [[{ kind: "term", word: "-force", negated: false }]],
    namedProps: [],
    speaksOfTrash: false,
  })
})

test("a phrase of one word is that word", () => {
  expect(selects(`"#home"`)).toEqual(["herbs", "kitchen", "hinges"])
  expect(selects(`"cabinets" "order"`)).toEqual(["order"])
})

test("a phrase is found in a note, and says so", () => {
  const [hit] = matching(derived, parseFilter(`"walnut or birch"`, TODAY))
  expect(hit?.at.node.id).toBe("order")
  expect(hit?.match.field).toBe("desc")
})

test("a quoted operator is the text, not the operator", () => {
  const literal = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": [
      `{"id":"note","ord":"a0","title":"what is:done reads","todo":true}`,
      `{"id":"ticked","ord":"a1","title":"something else","done":"2026-08-01"}`,
    ].join("\n"),
  }))
  expect(selectsIn(literal, `"is:done"`)).toEqual(["note"])
  expect(selectsIn(literal, "is:done")).toEqual(["ticked"])
  expect(parseFilter(`"is:open"`, TODAY).kind).toBe("asking")
})

test("a phrase does not cross the line break a note keeps", () => {
  const wrapped = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": `{"id":"list","ord":"a0","title":"the list","desc":"pick the\\nhinges"}`,
  }))
  expect(selectsIn(wrapped, "pick hinges")).toEqual(["list"])
  expect(selectsIn(wrapped, `"pick the hinges"`)).toEqual([])
})

test("a quote nothing closes is refused rather than closed for the reader", () => {
  const refused = refusalsOf(`"pick the`)
  expect(refused?.map((one) => one.token)).toEqual([`"pick the`])
  expect(refused?.[0]?.reason).toContain("a quote nothing closes")
  expect(selects(`"pick the`)).toEqual([])
  expect(refusalsOf(`kitchen "pick the`)).toHaveLength(1)
  expect(refusalsOf(`is:open "pick the`)?.map((one) => one.token))
    .toEqual(["is:open", `"pick the`])
  expect(refusalsOf(`hinges OR "pick the`)?.map((one) => one.token))
    .toEqual([`"pick the`])
})

test("a quote in the middle of a word is still a quote", () => {
  expect(refusalsOf(`36"`)?.[0]?.reason).toContain("a quote nothing closes")
  expect(parseFilter(`prop:stage="in review"`, TODAY).kind).toBe("asking")
})

test("a phrase with no words in it is refused, space or nothing", () => {
  expect(refusalsOf(`""`)?.[0]?.reason).toContain("no words in it")
  expect(refusalsOf(`-""`)).toHaveLength(1)
  expect(selects(`""`)).toEqual([])
  expect(refusalsOf(`" "`)).toHaveLength(1)
  expect(selects(`" "`)).toEqual([])
  expect(selects(`"  "`)).toEqual([])
  expect(selects(`"the cabinets"`)).toEqual(["order", "install"])
})

test("`OR` is satisfied by any one of the tokens it joins", () => {
  expect(selects("basil OR hinges")).toEqual(["basil", "hinges"])
  expect(selects("basil OR hinges OR garden")).toEqual(["garden", "basil", "hinges"])
  expect(selects("is:todo OR is:doing")).toEqual(["herbs", "kitchen", "order", "hinges"])
  expect(selects("is:marked -is:done")).toEqual(selects("is:todo OR is:doing"))
  expect(selects("#home OR is:done")).toEqual([
    "herbs",
    "basil",
    "kitchen",
    "demo",
    "hinges",
  ])
})

test("`OR` binds tighter than the AND between adjacent tokens", () => {
  expect(selects("#home kitchen OR cabinets")).toEqual(["kitchen"])
  expect(selects("cabinets")).toEqual(["order", "install"])
  expect(selects("garden OR cabinets the")).toEqual(["order", "install"])
  expect(selects("garden")).toEqual(["garden"])
  expect(selects("is:doing -herbs OR is:todo")).toEqual(["kitchen", "order"])
})

test("a group reports the highest-weighted field any of its words hit", () => {
  const best = (text: string) => matching(derived, parseFilter(text, TODAY))[0]?.match.field
  expect(best("walnut OR cabinets")).toBe("title")
  expect(best("cabinets OR walnut")).toBe("title")
})

test("`or` is a word and `OR` is the joiner", () => {
  expect(selects("walnut or birch")).toEqual(["order"])
  expect(selects("walnut OR hinges")).toEqual(["order", "hinges"])
  expect(selects("walnut or hinges")).toEqual([])
  expect(parseFilter("-OR", TODAY).kind).toBe("asking")
  expect(selects("-OR")).not.toContain("order")
})

test("a quoted `OR` is the word, in capitals", () => {
  const shouting = derive(TEST_CLAIMS, nodesOfFiles({
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
  expect(refusalsOf("is:open OR kitchen")?.map((one) => one.token)).toEqual(["is:open"])
  expect(refusalsOf("kitchen OR is:open")?.map((one) => one.token)).toEqual(["is:open"])
})

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

test("an alternative that names the archive opens it", () => {
  expect(selects("is:trashed OR nothing-is-called-this")).toEqual(["gone"])
})

test("`is:blocked` finds what is waiting, across the whole directory", () => {
  expect(selects("is:blocked")).toEqual(["herbs", "hinges"])
})

test("an edge is not a wait: a finished target, and a source that is not work", () => {
  expect(selects("has:after -is:blocked")).toEqual(["order", "install"])
})

test("a `blocks` written on the other record is waited on all the same", () => {
  const sugared = derive(TEST_CLAIMS, nodesOfFiles({
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

test("a node whose blocker is finished stops matching", () => {
  const finished = derive(TEST_CLAIMS, nodesOfFiles({
    ...CORPUS,
    "house.olai": CORPUS["house.olai"].replace(`"doing":true`, `"done":"2026-08-12"`),
  }))
  expect(selectsIn(finished, "is:done")).toContain("order")
  expect(selectsIn(finished, "is:blocked")).toEqual(["herbs"])
})

test("`prop:key` finds every node carrying that key", () => {
  expect(selects("prop:pr")).toEqual(["order"])
  expect(selects("prop:agent")).toEqual(["basil", "order"])
  expect(selects("prop:isbn")).toEqual([])
})

test("`prop:key=value` finds the nodes whose value is that", () => {
  expect(selects("prop:agent=claude-opus")).toEqual(["basil", "order"])
  expect(selects("prop:agent=codex")).toEqual([])
  expect(selects("prop:tags=walnut")).toEqual(["order"])
})

test("a key and a value are found however they were capitalised", () => {
  expect(selects("prop:AGENT")).toEqual(["basil", "order"])
  expect(selects("prop:Agent=Claude-Opus")).toEqual(["basil", "order"])
})

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
  expect(refusalsOf("prop:stage=")?.[0]?.reason).toContain("prop:agent=claude-opus")
  expect(refusalsOf("prop:=x")?.[0]?.reason).toContain("prop:pr")
})

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

test("a value may hold a space, which is what quoting one is for", () => {
  const spaced = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": [
      `{"id":"one","ord":"a0","title":"the first","custom":{"stage":"in review"}}`,
      `{"id":"two","ord":"a1","title":"the second","custom":{"stage":"in"}}`,
    ].join("\n"),
  }))
  expect(selectsIn(spaced, `prop:stage="in review"`)).toEqual(["one"])
  expect(selectsIn(spaced, "prop:stage=in review")).toEqual([])
})

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
    "desc, date, created, changed, see, after, repeat",
  )
  expect(refusalsOf("date:soon")?.[0]?.reason).toContain("2026-08-10")
  expect(refusalsOf("date:..")).toHaveLength(1)
})

test("a date no calendar could hold is refused, not answered with an empty tree", () => {
  for (const impossible of ["date:2026-13", "date:2026-00", "date:2026-08-32", "date:2026-01-00"]) {
    expect(refusalsOf(impossible)).toHaveLength(1)
    expect(selects(impossible)).toEqual([])
  }
  expect(refusalsOf("date:2026-13..2026-14")).toHaveLength(1)
  expect(refusalsOf("date:..2026-99")).toHaveLength(1)
  expect(refusalsOf("date:2026-99..")).toHaveLength(1)
  expect(parseFilter("date:2026-12-31", TODAY).kind).toBe("asking")
  expect(parseFilter("date:2026-01", TODAY).kind).toBe("asking")
})

test("a day that only some months have is accepted, and finds nothing", () => {
  expect(parseFilter("date:2026-02-30", TODAY).kind).toBe("asking")
  expect(selects("date:2026-02-30")).toEqual([])
})

test("an operator given no value says what actually went wrong", () => {
  expect(refusalsOf("is:")?.[0]?.reason).toContain("no value")
  expect(refusalsOf("date: 2026")?.[0]).toEqual({
    token: "date:",
    reason:
      "date: was given no value — a space after the colon splits it into two words",
  })
})

test("a refusal quotes the token the way it was typed", () => {
  expect(refusalsOf("is:OPEN")?.[0]?.token).toBe("is:OPEN")
  expect(refusalsOf("Date:Soon")?.[0]?.token).toBe("Date:Soon")
  expect(refusalsOf("-HAS:tags")?.[0]?.token).toBe("-HAS:tags")
  expect(selects("IS:DONE")).toEqual(["basil", "demo"])
  expect(selects("#HOME")).toEqual(["herbs", "kitchen", "hinges"])
  expect(selects("CABINETS")).toEqual(["order", "install"])
})

test("a colon after anything else is a colon in a word", () => {
  expect(refusalsOf("todo: http://example.com")).toBe(null)
  expect(selects("todo:")).toEqual([])
  expect(selects("order:")).toEqual([])
})

test("`is:mirrored` finds the node a placement shows, never the placement", () => {
  expect(selects("is:mirrored")).toEqual(["herbs"])
  expect(selects("is:mirrored")).not.toContain("kitchen-herbs")
  expect(selects("is:mirrored")).not.toContain("kitchen")
})

test("a chain of placements is places the node at the end of it is drawn", () => {
  const chained = derive(TEST_CLAIMS, nodesOfFiles({
    ...CORPUS,
    "shelf.olai": `{"id":"now-herbs","ord":"a0","mirror":"kitchen-herbs"}`,
  }))
  expect(selectsIn(chained, "is:mirrored")).toEqual(["herbs"])
})

test("a placement pointing at nothing mirrors nothing", () => {
  const dangling = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": `{"id":"a","ord":"a","title":"a"}\n{"id":"m","ord":"b","mirror":"nobody"}`,
  }))
  expect(selectsIn(dangling, "is:mirrored")).toEqual([])
})

test("`is:mirrored` composes and negates", () => {
  expect(selects("#home is:mirrored")).toEqual(["herbs"])
  expect(selects("-is:mirrored")).not.toContain("herbs")
  expect(selects("herb -is:mirrored")).toEqual([])
  expect(selects("is:mirrored OR is:blocked")).toEqual(["herbs", "hinges"])
})

test("`is:cancelled` selects the mark, and `is:marked` counts it", () => {
  expect(selectsIn(CALLED_OFF, "is:cancelled")).toEqual(["demo", "order"])
  expect(selectsIn(CALLED_OFF, "is:cancelled")).not.toContain("kitchen")
  expect(selectsIn(CALLED_OFF, "is:marked")).toContain("demo")
  expect(selectsIn(CALLED_OFF, "is:marked -is:done -is:cancelled"))
    .toEqual(["herbs", "kitchen", "hinges"])
  expect(selectsIn(CALLED_OFF, "-is:cancelled")).not.toContain("order")
  expect(selectsIn(CALLED_OFF, "cabinets is:cancelled")).toEqual(["order"])
})

test("`is:blocked` differs from the old derivation exactly at the cancelled targets", () => {
  const blockedTheOldWay = (derivation: Derived): Array<string> =>
    [...derivation.after.keys()]
      .filter((id) => {
        const inPlay = (target: string): boolean => {
          const at = derivation.byId.get(target)
          if (at === undefined || isPutAway(TEST_CLAIMS, at.file)) return false
          const mark = derivation.status.get(target)
          return mark !== undefined && mark !== "done"
        }
        return inPlay(id) &&
          (derivation.after.get(id) ?? []).some((target) => inPlay(target))
      })
      .sort()

  expect(selects("is:blocked").slice().sort()).toEqual(blockedTheOldWay(derived))

  const was = blockedTheOldWay(CALLED_OFF)
  const now = selectsIn(CALLED_OFF, "is:blocked").slice().sort()

  expect(was).toEqual(["herbs", "hinges", "order"])
  expect(now).toEqual(["herbs"])
  expect(now.every((id) => was.includes(id))).toBe(true)
})

test("`is:` teaches the mirrored value with the others", () => {
  expect(refusalsOf("is:mirror")?.[0]?.reason).toContain(
    "done, cancelled, doing, todo, marked, blocked, mirrored, trashed",
  )
})

test("the stamps are the record's own, and are not the journal's dates", () => {
  expect(selects("created:2026-08-01")).toEqual(["order"])
  expect(selects("changed:today")).toEqual(["order"])
  expect(selects("date:2026-08-10")).toEqual(["order"])
  expect(selects("created:2026-08-10")).toEqual([])
  expect(selects("changed:2026-08-10")).toEqual(["basil"])
})

test("a stamp is the day its instant falls on", () => {
  expect(selects("created:today")).toEqual(["install"])
  expect(selects("created:2025-12-31")).toEqual(["basil"])
  expect(selects("created:2026-01-01")).toEqual([])
})

test("a stamp takes every value a date does", () => {
  expect(selects("created:2026-07")).toEqual(["hinges"])
  expect(selects("created:2025")).toEqual(["basil"])
  expect(selects("created:this-week")).toEqual(["install"])
  expect(selects("changed:this-week")).toEqual(["basil", "order", "hinges"])
  expect(selects("changed:last-week")).toEqual([])
  expect(selects("created:last-month")).toEqual(["hinges"])
})

test("a stamp range is the same two comparisons a date range is", () => {
  expect(selects("created:..2026-07-31")).toEqual(["basil", "hinges"])
  expect(selects("created:2026-08-01..")).toEqual(["order", "install"])
  expect(selects("created:2026-07-01..today")).toEqual(["order", "install", "hinges"])
  expect(selects("changed:yesterday..today")).toEqual(["order"])
})

test("a node with no stamp is not found by any span, however wide", () => {
  expect(selects("created:2000..")).not.toContain("kitchen")
  expect(selects("created:..2100")).not.toContain("kitchen")
  expect(selects("created:2026")).not.toContain("kitchen")
  expect(selects("changed:2000..2100")).toEqual(["basil", "order", "hinges"])
})

test("negation finds the unstamped, as `-has:date` already found the undated", () => {
  expect(selects("-has:date")).toContain("kitchen")
  expect(selects("-created:2026")).toContain("kitchen")
  expect(selects("-created:2000..2100")).toEqual(["garden", "herbs", "kitchen", "demo"])
})

test("`has:` on a stamp is that operator unbounded, and the pair is sayable", () => {
  expect(selects("has:created")).toEqual(["basil", "order", "install", "hinges"])
  expect(selects("has:changed")).toEqual(["basil", "order", "hinges"])
  expect(selects("has:created -has:changed")).toEqual(["install"])
  expect(selects("has:created")).toEqual(selects("created:2000..2100"))
})

test("a stamp refuses what a date refuses, in its own name", () => {
  const refused = refusalsOf("created:soon")
  expect(refused?.map((one) => one.token)).toEqual(["created:soon"])
  expect(refused?.[0]?.reason).toContain("created: takes a day, month or year")
  expect(refused?.[0]?.reason).toContain("last-")
  expect(refusalsOf("changed:2026-13")).toHaveLength(1)
  expect(refusalsOf("changed:..")).toHaveLength(1)
  expect(refusalsOf("created:")?.[0]?.reason).toContain("no value")
})

test("a stamp reaches what was put away, when the query asks for it", () => {
  expect(selects("created:2026-06")).toEqual([])
  expect(selects("is:trashed created:2026-06")).toEqual(["gone"])
})

test("a stamp composes with words, marks and the joiner", () => {
  expect(selects("cabinets created:this-week")).toEqual(["install"])
  expect(selects("created:today OR created:2025")).toEqual(["basil", "install"])
  expect(selects("has:created -changed:this-week")).toEqual(["install"])
})

const NOW = `${TODAY}T11:00:00-04:00`

test("a bare duration is within the last N, which is the range it opens", () => {
  expect(selects("changed:1h", NOW)).toEqual(["order"])
  expect(selects("changed:1h..", NOW)).toEqual(selects("changed:1h", NOW))
  expect(selects("changed:30m", NOW)).toEqual([])
})

test("a duration as a range end is the moment, and the ends partition", () => {
  expect(selects("changed:..1h", NOW)).toEqual(["basil", "hinges"])
  expect(selects("changed:1h", NOW)).toEqual(["order"])
  expect(selects("has:changed", NOW)).toEqual(["basil", "order", "hinges"])
})

test("two durations are a window", () => {
  expect(selects("changed:2h..30m", NOW)).toEqual(["order"])
  expect(selects("changed:2h..1h", NOW)).toEqual([])
  expect(selects("changed:30m..", NOW)).toEqual([])
})

test("a duration and a day word are two ends of one range", () => {
  expect(selects("created:yesterday..3h", NOW)).toEqual(["install"])
  expect(selects("created:2026-08-01..3h", NOW)).toEqual(["order", "install"])
  expect(selects("changed:last-week..30m", NOW)).toEqual(["basil", "order", "hinges"])
})

test("a value sitting exactly on a bound is inside it, from either side", () => {
  expect(selects("created:3h", NOW)).toContain("install")
  expect(selects("created:..3h", NOW)).toContain("install")
})

test("a bound falls where the clock says, to the minute", () => {
  expect(selects("created:3h", NOW)).toEqual(["install"])
  expect(selects("created:..3h", NOW)).toContain("install")
  expect(selects("created:2h", NOW)).toEqual([])
})

test("the four units count minutes, hours, days and weeks", () => {
  expect(selects("changed:57m", NOW)).toEqual([])
  expect(selects("changed:58m", NOW)).toEqual(["order"])
  expect(selects("changed:60m", NOW)).toEqual(selects("changed:1h", NOW))
  expect(selects("changed:2d", NOW)).toEqual(["order"])
  expect(selects("changed:3d", NOW)).toEqual(["order", "hinges"])
  expect(selects("changed:1w", NOW)).toEqual(["basil", "order", "hinges"])
})

test("a duration's count is read as a number", () => {
  expect(selects("changed:90m", NOW)).toEqual(["order"])
  expect(selects("changed:01h", NOW)).toEqual(selects("changed:1h", NOW))
  expect(selects("changed:1H", NOW)).toEqual(selects("changed:1h", NOW))
  expect(parseFilter("changed:0h", NOW).kind).toBe("asking")
  expect(selects("changed:0h", NOW)).toEqual([])
})

const ON_THE_DOT = {
  "dot.olai": [
    `{"id":"now","ord":"a0","title":"stamped at the moment asked","created":"${NOW}"}`,
    `{"id":"minute","ord":"a1","title":"stamped a minute before","created":"2026-08-13T10:59:00-04:00"}`,
  ].join("\n"),
}

const onTheDot = derive(TEST_CLAIMS, nodesOfFiles(ON_THE_DOT))

test("a zero count is the moment asked, and a stamp on it is inside", () => {
  expect(selectsIn(onTheDot, "created:0m", NOW)).toEqual(["now"])
  expect(selectsIn(onTheDot, "created:0h", NOW)).toEqual(["now"])
  expect(selectsIn(onTheDot, "created:1m", NOW)).toEqual(["now", "minute"])
  expect(selectsIn(onTheDot, "created:..0m", NOW)).toEqual(["now", "minute"])
})

test("a window written backwards is empty, as an inverted day range is", () => {
  expect(selects("changed:2h..30m", NOW)).toEqual(["order"])
  expect(parseFilter("changed:30m..2h", NOW).kind).toBe("asking")
  expect(selects("changed:30m..2h", NOW)).toEqual([])
  expect(selects("changed:2026-08-14..2026-08-10", NOW)).toEqual([])
})

const BY_HAND = {
  "hand.olai": [
    `{"id":"plain","ord":"a0","title":"as this package writes one","created":"2026-08-13T08:00:00-04:00"}`,
    `{"id":"fraction","ord":"a1","title":"with a fraction nobody minted","created":"2026-08-13T08:00:00.000-04:00"}`,
    `{"id":"coarse","ord":"a2","title":"with the seconds left off","created":"2026-08-13T08:00-04:00"}`,
  ].join("\n"),
}

const byHand = derive(TEST_CLAIMS, nodesOfFiles(BY_HAND))

test("a hand-written instant on a bound is outside it, and that is the limit", () => {
  expect(selectsIn(byHand, "created:3h", NOW)).toContain("plain")
  expect(selectsIn(byHand, "created:..3h", NOW)).toContain("plain")
  expect(selectsIn(byHand, "created:..3h", NOW)).not.toContain("fraction")
  expect(selectsIn(byHand, "created:3h", NOW)).toContain("fraction")
  expect(selectsIn(byHand, "created:3h", NOW)).not.toContain("coarse")
  expect(selectsIn(byHand, "created:..3h", NOW)).toContain("coarse")
  expect(selectsIn(byHand, "has:created", NOW)).toEqual(["plain", "fraction", "coarse"])
})

test("a duration composes with words, marks and the joiner", () => {
  expect(selects("cabinets changed:1h", NOW)).toEqual(["order"])
  expect(selects("is:doing changed:1h", NOW)).toEqual(["order"])
  expect(selects("changed:1h OR created:3h", NOW)).toEqual(["order", "install"])
  expect(selects("-changed:1d", NOW)).not.toContain("order")
  expect(selects("-changed:1d", NOW)).toContain("hinges")
})

const ROLLING = {
  "rolling.olai": [
    `{"id":"morning","ord":"a0","title":"this morning","created":"2026-08-13T08:00:00-04:00"}`,
    `{"id":"evening","ord":"a1","title":"last night","created":"2026-08-12T22:00:00-04:00"}`,
    `{"id":"breakfast","ord":"a2","title":"yesterday early","created":"2026-08-12T07:00:00-04:00"}`,
    `{"id":"sunday","ord":"a3","title":"the weekend","changed":"2026-08-09T12:00:00-04:00"}`,
    `{"id":"monday","ord":"a4","title":"start of the week","changed":"2026-08-10T12:00:00-04:00"}`,
    `{"id":"older","ord":"a5","title":"the week before","changed":"2026-08-05T12:00:00-04:00"}`,
  ].join("\n"),
}

const rolling = derive(TEST_CLAIMS, nodesOfFiles(ROLLING))

test("`1d` is a rolling day where `today` is since midnight", () => {
  expect(selectsIn(rolling, "created:1d", NOW)).toEqual(["morning", "evening"])
  expect(selectsIn(rolling, "created:today", NOW)).toEqual(["morning"])
})

test("`1w` is a rolling week where `this-week` starts on Monday", () => {
  expect(selectsIn(rolling, "changed:1w", NOW)).toEqual(["sunday", "monday"])
  expect(selectsIn(rolling, "changed:this-week", NOW)).toEqual(["monday"])
})

const JOURNAL = {
  "journal.olai": [
    `{"id":"ticked","ord":"a0","title":"just ticked","done":"2026-08-13T10:40:00-04:00"}`,
    `{"id":"earlier","ord":"a1","title":"ticked at breakfast","done":"2026-08-13T07:00:00-04:00"}`,
    `{"id":"planned","ord":"a2","title":"planned for today","date":"2026-08-13"}`,
    `{"id":"soon","ord":"a3","title":"planned for tomorrow","date":"2026-08-14"}`,
  ].join("\n"),
}

const journal = derive(TEST_CLAIMS, nodesOfFiles(JOURNAL))

test("`date:1h` reaches the done-instants, and the day's plans sit before it", () => {
  expect(selectsIn(journal, "date:1h", NOW)).toEqual(["ticked", "soon"])
  expect(selectsIn(journal, "date:today", NOW)).toEqual(["ticked", "earlier", "planned"])
  expect(selectsIn(journal, "date:..1h", NOW)).toEqual(["earlier", "planned"])
})

test("a value that is not a duration is refused, with the units spelled out", () => {
  for (const value of ["1mo", "1y", "1month", "1q", "1s", "1h30m", "h", "1", "1h!"]) {
    const refused = refusalsOf(`created:${value}`, NOW)
    expect(refused?.map((one) => one.token)).toEqual([`created:${value}`])
  }
  expect(selects("changed:1M", NOW)).toEqual(selects("changed:1m", NOW))
  const taught = refusalsOf("created:1mo", NOW)?.[0]?.reason
  expect(taught).toContain("created: takes a day, month or year")
  expect(taught).toContain("1m = 1 minute")
  expect(taught).toContain("1w = 1 week")
  expect(taught).toContain("no month or year units")
  expect(taught).toContain("1h is 1h..")
})

test("a duration that walks off the calendar is refused, not answered emptily", () => {
  expect(refusalsOf("created:999999w", NOW)).toHaveLength(1)
  expect(refusalsOf("created:1234567h", NOW)).toHaveLength(1)
  expect(parseFilter("created:999999m", NOW).kind).toBe("asking")
})

test("the three day operators refuse a duration in the same words", () => {
  for (const name of ["date", "created", "changed"]) {
    expect(refusalsOf(`${name}:1y`, NOW)?.[0]?.reason).toContain(
      `${name}: takes a day, month or year`,
    )
    expect(refusalsOf(`${name}:1y`, NOW)?.[0]?.reason).toContain("no month or year units")
  }
})

test("a duration counts from the moment the clock names", () => {
  expect(selects("changed:1h", `${TODAY}T10:30:00-04:00`)).toEqual(["order"])
  expect(selects("changed:1h", `${TODAY}T11:30:00-04:00`)).toEqual([])
  expect(parseFilter("changed:1h", TODAY).kind).toBe("asking")
})

test("what was put away stays put away until it is asked for", () => {
  expect(selects("#home")).not.toContain("gone")
  expect(selects("kitchen")).toEqual(["kitchen"])
  expect(selects("is:trashed")).toEqual(["gone"])
  expect(selects("#home is:trashed")).toEqual(["gone"])
  expect(selects("#home -is:trashed")).toEqual(["herbs", "kitchen", "hinges"])
})

test("a scope that is already the archive is answered rather than overruled", () => {
  const home = parseFilter("#home", TODAY)
  expect(matching(derived, home, { trashed: true }).map(({ at }) => at.node.id))
    .toEqual(["gone", "herbs", "kitchen", "hinges"])
  const archived = parseFilter("#home is:trashed", TODAY)
  expect(matching(derived, archived, { trashed: true }).map(({ at }) => at.node.id))
    .toEqual(["gone"])
  const live = parseFilter("#home -is:trashed", TODAY)
  expect(matching(derived, live, { trashed: true }).map(({ at }) => at.node.id))
    .toEqual(["herbs", "kitchen", "hinges"])
  expect(
    matching(derived, home, { trashed: true, file: "_olai/Trash.olai" })
      .map(({ at }) => at.node.id),
  ).toEqual(["gone"])
})

test("a leftover Archive.olai is in no query, including is:trashed", () => {
  const leftover = derive(TEST_CLAIMS, nodesOfFiles({
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

test("the field a match is reported under is the highest-weighted one that held it", () => {
  const [hit] = matching(derived, parseFilter("cabinets order", TODAY))
  expect(hit?.match.field).toBe("title")
  const [note] = matching(derived, parseFilter("walnut", TODAY))
  expect(note?.match.field).toBe("desc")
  const [marked] = matching(derived, parseFilter("is:todo", TODAY))
  expect(marked?.match.field).toBe(null)
})

const propsOf = (text: string): ReadonlyArray<string> =>
  matching(derived, parseFilter(text, TODAY))[0]?.match.props ?? []

test("a `prop:` clause names the key it selected on, beside the field the words did", () => {
  const [both] = matching(derived, parseFilter("cabinets prop:agent", TODAY))
  expect(both?.match.field).toBe("title")
  expect(both?.match.props).toEqual(["agent"])
})

test("a query that names no property says so with an empty list", () => {
  expect(propsOf("cabinets")).toEqual([])
  expect(propsOf("is:todo")).toEqual([])
})

test("every positive clause is named, once, however many times it is asked", () => {
  expect(propsOf("prop:agent prop:pr")).toEqual(["agent", "pr"])
  expect(propsOf("prop:pr prop:pr=https://github.com/juspay/olai/pull/176"))
    .toEqual(["pr"])
})

test("the keys are named in the order the query named them, not the order they are tested in", () => {
  expect(propsOf("prop:agent prop:pr")).toEqual(["agent", "pr"])
  expect(propsOf("prop:agent OR cabinets prop:pr")).toEqual(["agent", "pr"])
  expect(propsOf("prop:pr OR cabinets prop:agent")).toEqual(["pr", "agent"])
})

test("the key is reported as the NODE spells it, whatever was typed", () => {
  expect(propsOf("prop:AGENT")).toEqual(["agent"])
  expect(propsOf("prop:Agent=Claude-Opus")).toEqual(["agent"])
})

test("a negated clause names nothing, because nothing carried it", () => {
  const [hit] = matching(derived, parseFilter("is:done -prop:agent", TODAY))
  expect(hit?.at.node.id).toBe("demo")
  expect(hit?.match.props).toEqual([])
})

test("a scope narrows to one outline, or to one node and everything beneath it", () => {
  const home = parseFilter("#home", TODAY)
  expect(
    matching(derived, home, { file: "garden.olai" }).map(({ at }) => at.node.id),
  ).toEqual(["herbs"])
  expect(
    matching(derived, home, { under: "kitchen" }).map(({ at }) => at.node.id),
  ).toEqual(["kitchen", "hinges"])
  expect(
    matching(derived, home, { under: "hinges" }).map(({ at }) => at.node.id),
  ).toEqual(["hinges"])
})

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
  expect(matchedIn(house, matched)).toBe(3)
})

const listed = (groups: ReadonlyArray<DayGroup>): ReadonlyArray<string> =>
  groups.flatMap((group) =>
    group.nodes.map((one) => `${group.file}/${one.shows.node.id}`)
  )

const onDay = (day: string): ReadonlyArray<DayGroup> => datedOn(derived, day)

const idsOf = (text: string): ReadonlySet<string> =>
  new Set(matching(derived, parseFilter(text, TODAY)).map(({ at }) => at.node.id))

test("a filtered day keeps what matched and nothing as context", () => {
  const tenth = onDay("2026-08-10")
  expect(listed(tenth)).toEqual(["house.olai/order"])
  expect(listed(keepingDated(tenth, idsOf("cabinets")))).toEqual([
    "house.olai/order",
  ])
  expect(listed(keepingDated(tenth, idsOf("kitchen remodel")))).toEqual([])
})

test("an outline with nothing left is not a heading over no rows", () => {
  const tenth = onDay("2026-08-10")
  expect(tenth.map((group) => group.file)).toEqual(["house.olai"])
  expect(keepingDated(tenth, idsOf("nothing-is-called-this"))).toEqual([])
})

test("a day draws none of the archive, and `is:trashed` still reaches it", () => {
  expect(onDay("2026-06-01")).toEqual([])
  expect(selects("is:trashed")).toEqual(["gone"])
})

test("`is:trashed` and `date:` compose over a day the page itself draws empty", () => {
  expect(selects("is:trashed date:2026-06-01")).toEqual(["gone"])
  expect(selects("date:2026-06-01")).toEqual([])
})

const bestOf = (text: string, limit: number): ReadonlyArray<string> =>
  ranked(derived, matching(derived, parseFilter(text, TODAY)))
    .slice(0, limit)
    .map(({ at }) => at.node.id)

test("the shortlist is ranked, where the answer it is cut from is not", () => {
  expect(matching(derived, parseFilter("the", TODAY)).map(({ at }) => at.node.id))
    .toEqual(["herbs", "basil", "demo", "order", "install", "hinges"])
  expect(bestOf("the", 3)).toEqual(["herbs", "order", "install"])
})

test("a finished node loses ties without losing its place in the list", () => {
  expect(bestOf("the", 8))
    .toEqual(["herbs", "order", "install", "hinges", "basil", "demo"])
})

test("the cap is a cap, and ties keep the set's own order", () => {
  expect(bestOf("#home", 8)).toEqual(["herbs", "kitchen", "hinges"])
  expect(bestOf("#home", 2)).toEqual(["herbs", "kitchen"])
  expect(bestOf("#home", 0)).toEqual([])
})

test("what was put away is out of a shortlist too, unless the query says so", () => {
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

const needles = (text: string): ReadonlyArray<string> => needlesFrom(text, TODAY)

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
  expect(needles("cabinets -walnut")).toEqual(["cabinets"])
  expect(needles("-walnut")).toEqual([])
})

test("a query with no words in it has no needles at all", () => {
  expect(needles("is:done")).toEqual([])
  expect(needles("date:2026-08-10 prop:pr")).toEqual([])
  expect(needles("")).toEqual([])
  expect(needles("is:open")).toEqual([])
})

test("a needle lands wherever the fold finds it, whatever case it was written in", () => {
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
  expect(lit("pick the hinges", 'pick "pick the"')).toBe("[pick the] hinges")
  expect(lit("cabinets", "cabinet cabinets")).toBe("[cabinets]")
})

test("a text the query is not in has no runs, and neither has an empty query", () => {
  expect(litBy("order the cabinets", needles("walnut"))).toEqual([])
  expect(litBy("order the cabinets", needles("is:done"))).toEqual([])
  expect(litBy("", needles("cabinets"))).toEqual([])
})

test("a tag is lit as the text it is, sigil and all or bare", () => {
  expect(lit("kitchen remodel #home", "#home")).toBe("kitchen remodel [#home]")
  expect(lit("kitchen remodel #home", "home")).toBe("kitchen remodel #[home]")
})

test("a fold that changes length is mapped back onto what was written", () => {
  expect(lit("İstanbul cabinets", "cabinets")).toBe("İstanbul [cabinets]")
  expect(lit("aİb cabinets", "cabinets")).toBe("aİb [cabinets]")
})

test("a needle landing INSIDE such a character lights the whole of it", () => {
  expect(lit("İstanbul", "i")).toBe("[İ]stanbul")
  expect(lit("aİb", "i")).toBe("a[İ]b")
  expect(lit("İstanbul", "i\u0307")).toBe("[İ]stanbul")
  expect(lit("İstanbul", "i\u0307st")).toBe("[İst]anbul")
  expect(lit("aİb", "ai")).toBe("[aİ]b")
})

test("no run a needle produces is ever empty, whatever the fold did", () => {
  for (const text of ["İstanbul", "aİb", "İİ", "ﬁle", "ǅungla", "plain"]) {
    for (const needle of ["i", "i\u0307", "a", "l", "ǆ", "ﬁ"]) {
      for (const one of litBy(text, [needle])) {
        expect(one.end, `${text} / ${needle}`).toBeGreaterThan(one.at)
        expect(text.slice(one.at, one.end), `${text} / ${needle}`).not.toBe("")
      }
    }
  }
})

const BOARD = {
  "_olai/Properties.olai": [
    `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
    `{"id":"prop-dispatched","ord":"a1","title":"dispatched","custom":{"type":"date"}}`,
    `{"id":"prop-merge","ord":"a2","title":"merge","custom":{"type":"ref"}}`,
    `{"id":"auto","parent":"prop-merge","ord":"a0","title":"automatic"}`,
    `{"id":"human","parent":"prop-merge","ord":"a1","title":"the human merges"}`,
  ].join("\n"),
  "lanes.olai": [
    `{"id":"l-189","ord":"a0","title":"the backlinks lane","custom":{"pr":"189","dispatched":"2026-08-19T09:00:00-04:00","merge":"auto"}}`,
    `{"id":"l-193","ord":"a1","title":"the props lane","custom":{"pr":"193","dispatched":"2026-08-25T10:06:00-04:00","merge":"human"}}`,
    `{"id":"l-200","ord":"a2","title":"the chip lane","custom":{"pr":"200","dispatched":"2026-08-21","merge":"auto"}}`,
    `{"id":"l-1000","ord":"a3","title":"the far lane","custom":{"pr":"1000"}}`,
    `{"id":"l-none","ord":"a4","title":"an unboarded lane","custom":{"terminal":"a-uuid"}}`,
  ].join("\n"),
}

const board = derive(TEST_CLAIMS, nodesOfFiles(BOARD))
const typing = declarationsOf(board, NO_KINDS)

const onBoard = (text: string, today = TODAY): ReadonlyArray<string> =>
  matching(board, parseFilter(text, today, typing)).map(({ at }) => at.node.id)

test("a range on an int key is a span, and it compares as a NUMBER", () => {
  expect(onBoard("prop:pr=190..200")).toEqual(["l-193", "l-200"])
  expect(onBoard("prop:pr=9..200")).toEqual(["l-189", "l-193", "l-200"])
  expect(onBoard("prop:pr=200..")).toEqual(["l-200", "l-1000"])
  expect(onBoard("prop:pr=..190")).toEqual(["l-189"])
})

test("a bare number on an int key is that number, compared as one", () => {
  expect(onBoard("prop:pr=193")).toEqual(["l-193"])
  expect(parseFilter("prop:pr=0193", TODAY, typing).kind).toBe("refused")
})

test("a range on a date key reuses `created:`'s own syntax, whole", () => {
  expect(onBoard("prop:dispatched=2026-08-20..")).toEqual(["l-193", "l-200"])
  expect(onBoard("prop:dispatched=..2026-08-20")).toEqual(["l-189"])
  expect(onBoard("prop:dispatched=2026-08-19..2026-08-21")).toEqual(["l-189", "l-200"])
  expect(onBoard("prop:dispatched=2026-08-25")).toEqual(["l-193"])
  expect(onBoard("prop:dispatched=this-month", "2026-08-25")).toEqual([
    "l-189",
    "l-193",
    "l-200",
  ])
})

test("equality on a ref is exactly as it was, and the value is the id", () => {
  expect(onBoard("prop:merge=auto")).toEqual(["l-189", "l-200"])
  expect(onBoard("prop:merge=automatic")).toEqual([])
})

test("a range on an untyped key is REFUSED, with the reason", () => {
  const refused = parseFilter("prop:terminal=190..200", TODAY, typing)
  expect(refused.kind).toBe("refused")
  const reason = refused.kind === "refused" ? refused.refusals[0]?.reason ?? "" : ""
  expect(reason).toContain("nothing declares `terminal`")
  expect(reason).toContain("Declare the key `date` or `int`")
})

test("a range on a key declared something that cannot compare names what it IS", () => {
  const refused = parseFilter("prop:merge=190..200", TODAY, typing)
  expect(refused.kind).toBe("refused")
  expect(refused.kind === "refused" ? refused.refusals[0]?.reason : "").toContain(
    "`merge` is declared `ref`",
  )
})

test("a value that merely CONTAINS `..` is the equality it always was", () => {
  expect(parseFilter("prop:worktree=../sibling", TODAY, typing).kind).toBe("asking")
  expect(parseFilter("prop:version=1.0..2.0", TODAY, typing).kind).toBe("asking")
})

test("a value an int key cannot be asked about is refused, teaching the shape", () => {
  const refused = parseFilter("prop:pr=lots", TODAY, typing)
  expect(refused.kind).toBe("refused")
  expect(refused.kind === "refused" ? refused.refusals[0]?.reason : "").toContain(
    "prop:pr is a whole number",
  )
})

test("a value a date key cannot be asked about is taught the day grammar", () => {
  const refused = parseFilter("prop:dispatched=soon", TODAY, typing)
  expect(refused.kind).toBe("refused")
  expect(refused.kind === "refused" ? refused.refusals[0]?.reason : "").toContain(
    "prop:dispatched is a date",
  )
})

test("with no declarations in hand, a span token is the equality it used to be", () => {
  const bare = parseFilter("prop:pr=190..200", TODAY)
  expect(bare.kind).toBe("asking")
  expect(bare.kind === "asking" ? bare.namedProps[0] : undefined).toEqual({
    kind: "prop",
    key: "pr",
    value: "190..200",
  })
})

test("a span still reports WHICH key answered, like every other prop clause", () => {
  const [hit] = matching(board, parseFilter("prop:pr=190..200", TODAY, typing))
  expect(hit?.match.props).toEqual(["pr"])
})

const roll = seeded(0x7139)

const GENERATED = Array.from({ length: 120 }, (_, at) => {
  const pr = Math.floor(roll() * 2000)
  const day = 1 + Math.floor(roll() * 28)
  const dispatched = roll() < 0.5
    ? `2026-08-${String(day).padStart(2, "0")}`
    : `2026-08-${String(day).padStart(2, "0")}T${String(at % 24).padStart(2, "0")}:00:00-04:00`
  return { id: `g-${at}`, pr, dispatched }
})

const generated = derive(TEST_CLAIMS, nodesOfFiles({
  "_olai/Properties.olai": [
    `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
    `{"id":"prop-dispatched","ord":"a1","title":"dispatched","custom":{"type":"date"}}`,
  ].join("\n"),
  "lanes.olai": GENERATED.map((lane, at) =>
    `{"id":"${lane.id}","ord":"a${at}","title":"lane ${at}","custom":{"pr":"${lane.pr}","dispatched":"${lane.dispatched}"}}`
  ).join("\n"),
}))
const generatedTyping = declarationsOf(generated, NO_KINDS)

test("an int span selects exactly the lanes whose number is in it", () => {
  for (let round = 0; round < 60; round++) {
    const low = Math.floor(roll() * 2000)
    const high = low + Math.floor(roll() * 500)
    const [from, to] = [roll() < 0.25 ? null : low, roll() < 0.25 ? null : high]
    const text = `prop:pr=${from ?? ""}..${to ?? ""}`
    if (from === null && to === null) continue
    const asked = matching(generated, parseFilter(text, TODAY, generatedTyping))
      .map(({ at }) => at.node.id)
    const oracle = GENERATED
      .filter((lane) => (from === null || lane.pr >= from) && (to === null || lane.pr <= to))
      .map((lane) => lane.id)
    expect({ text, asked }).toEqual({ text, asked: oracle })
  }
})

test("a date span selects exactly the lanes whose stored date is in it", () => {
  for (let round = 0; round < 60; round++) {
    const low = 1 + Math.floor(roll() * 28)
    const high = low + Math.floor(roll() * 10)
    const day = (which: number) => `2026-08-${String(Math.min(which, 31)).padStart(2, "0")}`
    const [from, to] = [roll() < 0.25 ? null : day(low), roll() < 0.25 ? null : day(high)]
    const text = `prop:dispatched=${from ?? ""}..${to ?? ""}`
    if (from === null && to === null) continue
    const asked = matching(generated, parseFilter(text, TODAY, generatedTyping))
      .map(({ at }) => at.node.id)
    const oracle = GENERATED
      .filter((lane) =>
        (from === null || lane.dispatched >= from) &&
        (to === null || lane.dispatched <= to || lane.dispatched.startsWith(to))
      )
      .map((lane) => lane.id)
    expect({ text, asked }).toEqual({ text, asked: oracle })
  }
})

test("a node is at or under itself, which is what `under:` means", () => {
  expect(insideSubtree(derived, "kitchen", "kitchen")).toBe(true)
})

test("…and so is everything beneath it, however deep", () => {
  expect(insideSubtree(derived, "install", "kitchen")).toBe(true)
  expect(insideSubtree(derived, "hinges", "kitchen")).toBe(true)
  expect(insideSubtree(derived, "basil", "garden")).toBe(true)
})

test("a node in another tree is outside, and so is one in the trash", () => {
  expect(insideSubtree(derived, "garden", "kitchen")).toBe(false)
  expect(insideSubtree(derived, "gone", "kitchen")).toBe(false)
  expect(insideSubtree(derived, "kitchen", "install")).toBe(false)
})

test("a subtree does not reach through a mirror placed inside it", () => {
  expect(insideSubtree(derived, "kitchen-herbs", "kitchen")).toBe(true)
  expect(insideSubtree(derived, "herbs", "kitchen")).toBe(false)
  expect(insideSubtree(derived, "basil", "kitchen")).toBe(false)
})

test("the predicate selects exactly what `search under:` selects", () => {
  const ids = derived.nodes.map((at) => at.node.id)
  let scoped = 0
  for (const under of ids) {
    const asked = matching(derived, parseFilter("e", TODAY), { under, trashed: true })
      .map(({ at }) => at.node.id)
    const oracle = derived.nodes
      .filter((at) => !isMirror(at.node) && insideSubtree(derived, at.node.id, under))
      .map((at) => at.node.id)
    expect({ under, asked: [...asked].sort() }).toEqual({ under, asked: [...oracle].sort() })
    scoped += asked.length
  }
  expect(scoped).toBeGreaterThan(ids.length)
  expect(scoped).toBeLessThan(ids.length * ids.length)
})
