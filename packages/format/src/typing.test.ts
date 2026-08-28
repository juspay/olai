/**
 * TYPED PROPERTIES, at the floor: what a vault declares, what a value has to
 * be, and the two spellings that get normalised into one.
 *
 * The doors are tested where they are (`@olai/ops`' `plan.test.ts` for the five
 * that write a property, `./validate.test.ts` for the file that lands broken);
 * this file is the RULE they all reach, asked once per kind and once per
 * accepted spelling. Which is the split the sentence itself has: it is written
 * once in `./typing.ts` and worn twice, so it is proved once here rather than
 * twice at the doors.
 */

import { expect, test } from "bun:test"

import { derive } from "./derive.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
import {
  BOOTSTRAP,
  canonicalDate,
  declarationsOf,
  isDigitRun,
  isPathShaped,
  NO_TYPING,
  offsetIn,
  PATH_BASES,
  PROP_KINDS,
  sameTyping,
  storedValue,
  type Typed,
  variantsOf,
  wrongDeclaration,
  wrongValue,
} from "./typing.ts"
import { Result } from "effect"

/**
 * A vault that declares one of every kind, with the rosters the reference kinds
 * point at — the corpus nearly every case below is asked of.
 *
 * The keys are the live board's own (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/typed-properties.md`
 * audited them), because a fixture that invented its vocabulary would be
 * proving something about a vault nobody has.
 */
const FILES = {
  "_olai/Properties.olai": [
    `{"id":"prop-merge","ord":"a0","title":"merge","custom":{"type":"ref"}}`,
    `{"id":"auto","parent":"prop-merge","ord":"a0","title":"automatic"}`,
    `{"id":"human","parent":"prop-merge","ord":"a1","title":"the human merges"}`,
    `{"id":"prop-dispatched","ord":"a1","title":"dispatched","custom":{"type":"date"}}`,
    `{"id":"prop-pr","ord":"a2","title":"pr","custom":{"type":"int"}}`,
    `{"id":"prop-worktree","ord":"a3","title":"worktree","custom":{"type":"path"}}`,
    `{"id":"prop-brief","ord":"a4","title":"brief","custom":{"type":"doc"}}`,
    `{"id":"prop-agent","ord":"a5","title":"agent","custom":{"type":"ref","under":"agents-roster"}}`,
    `{"id":"prop-item","ord":"a6","title":"item","custom":{"type":"node"}}`,
    `{"id":"prop-from","ord":"a7","title":"from","custom":{"type":"text"}}`,
  ].join("\n"),
  "orchestrator/agents.olai": [
    `{"id":"agents-roster","ord":"a0","title":"the agents"}`,
    `{"id":"claude","parent":"agents-roster","ord":"a0","title":"Claude"}`,
    `{"id":"grok","parent":"agents-roster","ord":"a1","title":"Grok"}`,
    `{"id":"pi","parent":"agents-roster","ord":"a2","title":"pi"}`,
    `{"id":"a-mirror","parent":"agents-roster","ord":"a3","mirror":"lane"}`,
  ].join("\n"),
  "orchestrator/lanes.olai": [
    `{"id":"lane","ord":"a0","title":"the doc-backlinks lane"}`,
  ].join("\n"),
}

const derived = derive(nodesOfFiles(FILES))

/** The `.md` files this directory serves — what a `doc` value may resolve to.
 *  Written as a set rather than assembled through `setOf`, because the check
 *  reads exactly this and a fixture that built a whole `OutlineSet` for it
 *  would be proving something about the assembly. */
const DOCUMENTS: ReadonlySet<string> = new Set(["briefs/pdb.md", "docs/format.md"])

const typed: Typed = { declarations: declarationsOf(derived), derived, documents: DOCUMENTS }

/** What is wrong with a value on a record of `orchestrator/lanes.olai` — the
 *  file the live board's lanes are in, so a relative `doc` is resolved from one
 *  directory in, exactly as it is on the real one. */
const wrong = (key: string, value: string): string | undefined =>
  wrongValue(typed, "orchestrator/lanes.olai", key, value)

/** An instant with a known offset, so the normaliser's one impure input is a
 *  constant here rather than the machine's zone. */
const NOW = "2026-08-25T10:06:00-04:00"

/** What a door would STORE, or the sentence it refuses with. */
const stored = (key: string, value: string): string =>
  Result.match(storedValue(typed, "orchestrator/lanes.olai", key, value, NOW), {
    onSuccess: (held) => held,
    onFailure: (said) => `REFUSED: ${said}`,
  })

// ── what a vault declares ──────────────────────────────────────────────

test("a directory with no Properties.olai declares nothing, and every key is text", () => {
  const bare = derive(nodesOfFiles({ "a.olai": `{"id":"one","ord":"a0","title":"one"}` }))
  expect(declarationsOf(bare)).toEqual(NO_TYPING)
  expect(
    wrongValue(
      { declarations: declarationsOf(bare), derived: bare, documents: new Set() },
      "a.olai",
      "dispatched",
      "2026-08-25 10:06 (sweep queue #5)",
    ),
  ).toBeUndefined()
})

test("the declarations are the file's TOP LEVEL, one per key, and the variants are children", () => {
  expect([...typed.declarations.keys()]).toEqual([
    "merge",
    "dispatched",
    "pr",
    "worktree",
    "brief",
    "agent",
    "item",
    "from",
  ])
  // A variant is not a key: `auto` hangs under `merge` and declares nothing.
  expect(typed.declarations.has("automatic")).toBe(false)
})

test("a ref with no `under` takes its variants from the declaration's own children", () => {
  const merge = typed.declarations.get("merge")
  expect(merge?.type).toEqual({ kind: "ref" })
  expect(variantsOf(derived, merge!)).toEqual(["auto", "human"])
})

test("a ref WITH `under` takes them from that node, and a mirror filed there is not one", () => {
  const agent = typed.declarations.get("agent")
  expect(agent?.type).toEqual({ kind: "ref", under: "agents-roster" })
  // `a-mirror` sits under the roster and is a placement — a second view of
  // something, never a variant.
  expect(variantsOf(derived, agent!)).toEqual(["claude", "grok", "pi"])
})

test("the variants are IDS, and a title is not one", () => {
  // `auto` is the id; `automatic` is the title. The value is the id, which is
  // the pin and mirror rule: names rename, ids don't. Nothing resolves the id
  // to the title for display yet — the id is what a chip draws.
  expect(wrong("merge", "auto")).toBeUndefined()
  expect(wrong("merge", "automatic")).toBeDefined()
})

test("two readings of one vault DECLARE the same thing, and a moved declaration does not", () => {
  expect(sameTyping(typed.declarations, declarationsOf(derive(nodesOfFiles(FILES))))).toBe(true)
  const moved = derive(nodesOfFiles({
    ...FILES,
    "_olai/Properties.olai": FILES["_olai/Properties.olai"]
      .replace(`"type":"date"`, `"type":"int"`),
  }))
  expect(sameTyping(typed.declarations, declarationsOf(moved))).toBe(false)
})

// ── the seven kinds ────────────────────────────────────────────────────

test("text takes anything, which is what DECLARING it is for", () => {
  // `from` is provenance — a sentence by nature — and the declaration is the
  // durable blessing rather than an absence somebody could tidy away.
  expect(wrong("from", "the human, over lunch on the 19th")).toBeUndefined()
})

test("a date refuses a date with a story stapled on, and names the two shapes", () => {
  expect(wrong("dispatched", "2026-08-25T10:06:00-04:00")).toBeUndefined()
  expect(wrong("dispatched", "2026-08-25")).toBeUndefined()
  const said = wrong("dispatched", "2026-08-25 10:06 (sweep queue #5)")
  expect(said).toContain("`dispatched` is a date")
  expect(said).toContain("the story goes in the note")
})

test("an int is a digit run, and the refusal says which digits are not allowed", () => {
  expect(wrong("pr", "193")).toBeUndefined()
  expect(wrong("pr", "0")).toBeUndefined()
  const said = wrong("pr", "https://github.com/juspay/olai/pull/193")
  expect(said).toContain("`pr` is a whole number")
  expect(said).toContain("no leading zeros")
  expect(wrong("pr", "0193")).toBeDefined()
  expect(wrong("pr", "+193")).toBeDefined()
  expect(wrong("pr", "1_000")).toBeDefined()
  expect(wrong("pr", "193 (merged)")).toBeDefined()
})

test("a path is one run with no spaces in it, and the remark is refused", () => {
  expect(wrong("worktree", ".worktrees/doc-backlinks-index")).toBeUndefined()
  expect(wrong("worktree", "/home/srid/code/olai")).toBeUndefined()
  expect(wrong("worktree", ".worktrees/doc-backlinks-index (resumed)")).toContain(
    "no spaces in it",
  )
})

test("a doc resolves against the naming outline's own directory", () => {
  // Written on a record of `orchestrator/lanes.olai`, so `../briefs/pdb.md` is
  // the served document and a bare `briefs/pdb.md` is not.
  expect(wrong("brief", "../briefs/pdb.md")).toBeUndefined()
  const said = wrong("brief", "briefs/pdb.md")
  expect(said).toContain("orchestrator/briefs/pdb.md")
  expect(said).toContain("no such `.md` file is served")
})

test("a ref with no `under` reads as a sum, and one with it names the place", () => {
  expect(wrong("merge", "auto")).toBeUndefined()
  expect(wrong("merge", "AUTO: grok review folded + CI green")).toContain(
    "`merge` is `auto` | `human`",
  )
  expect(wrong("agent", "claude")).toBeUndefined()
  const said = wrong("agent", "claude-opus (the #336 author session, resumed)")
  expect(said).toContain("names a node under `agents-roster`")
  expect(said).toContain("`claude`, `grok`, `pi`")
})

test("a ref value close enough to be a typo of a variant is offered it", () => {
  expect(wrong("agent", "clade")).toContain("did you mean `claude`?")
})

test("a node value is any node in the set, and a mirror is not one", () => {
  expect(wrong("item", "lane")).toBeUndefined()
  expect(wrong("item", "a-mirror")).toContain("is a mirror")
  expect(wrong("item", "no-such-node")).toContain("is not one this set declares")
})

test("a DANGLING ref value is flagged the way a dangling edge is — with a did-you-mean", () => {
  // The roster node is deleted while a lane still names it. The value goes
  // stale exactly as an `after` edge does, and the sentence offers the nearest
  // thing that still exists.
  const without = derive(nodesOfFiles({
    ...FILES,
    "orchestrator/agents.olai": FILES["orchestrator/agents.olai"]
      .split("\n")
      .filter((line) => !line.includes(`"id":"grok"`))
      .join("\n"),
  }))
  const after: Typed = {
    declarations: declarationsOf(without),
    derived: without,
    documents: DOCUMENTS,
  }
  expect(wrongValue(after, "orchestrator/lanes.olai", "agent", "grok")).toContain(
    "names a node under `agents-roster`",
  )
})

test("a LIST is checked member by member, and the sentence quotes the bad one", () => {
  // No door writes one — `set_prop` and `add_node`'s map are text — so this arm
  // is reached by a hand-edited file alone, and it still has to answer.
  expect(wrong("pr", "190")).toBeUndefined()
  expect(wrongValue(typed, "orchestrator/lanes.olai", "pr", ["190", "191"])).toBeUndefined()
  expect(wrongValue(typed, "orchestrator/lanes.olai", "pr", ["190", "#191"]))
    .toContain(`"#191"`)
})

// ── the two normalisation tables ───────────────────────────────────────

/** ACCEPTED SPELLINGS → THE ONE STORED SPELLING. Each row is a thing somebody
 *  reasonably types and the single form the vault ends up holding — "one name,
 *  one spelling", which is the divergence sweep's lesson applied to a value. */
const NORMALISED: ReadonlyArray<readonly [string, string]> = [
  ["2026-08-25", "2026-08-25"],
  ["  2026-08-25  ", "2026-08-25"],
  ["2026-8-5", "2026-08-05"],
  // The day page's own leniency: a space where ISO writes `T`.
  ["2026-08-25 10:06", "2026-08-25T10:06:00-04:00"],
  ["2026-08-25T10:06", "2026-08-25T10:06:00-04:00"],
  ["2026-08-25T10:06:07", "2026-08-25T10:06:07-04:00"],
  // A value that already carries an offset keeps it — it names ONE instant, and
  // re-stamping it with the writer's zone would move it.
  ["2026-08-25T10:06:00-07:00", "2026-08-25T10:06:00-07:00"],
  ["2026-08-25T10:06Z", "2026-08-25T10:06:00+00:00"],
  // `Z` AND `+00:00` ARE ONE OFFSET AND TWO SPELLINGS: the numeric one is what
  // `set_done` writes for every offset including zero, so it is the one this
  // format holds — and UTC does not get to be the single zone in which two
  // files meaning the same thing differ byte for byte.
  ["2026-08-25T10:06:00Z", "2026-08-25T10:06:00+00:00"],
  // Seconds and no further (`./stamp.ts`'s rule), so a fraction is dropped
  // rather than carried into a spelling nothing else writes.
  ["2026-08-25T10:06:07.482-04:00", "2026-08-25T10:06:07-04:00"],
]

test("a date's accepted spellings all store the ONE spelling set_done writes", () => {
  for (const [written, held] of NORMALISED) {
    expect(stored("dispatched", written)).toBe(held)
  }
})

/** REFUSED SHAPES. Every one of them is a date somebody could believe in and
 *  none of them is a value this vault will hold. */
const REFUSED: ReadonlyArray<string> = [
  "2026-08-25 10:06 (sweep queue #5)",
  "yesterday",
  "25/08/2026",
  "Aug 25 2026",
  "2026-02-30",
  "2026-08-25T25:06:00-04:00",
  "2026-08-25T10:70:00-04:00",
  "",
  "soon",
]

test("a date's refused shapes are refused, each of them", () => {
  for (const written of REFUSED) {
    expect(stored("dispatched", written)).toStartWith("REFUSED:")
  }
})

test("the stored spelling is what the VALIDATOR accepts, which is what makes one rule", () => {
  // The door normalises and then checks with the same function the validator
  // reports through, so a value a door writes can never be one the validator
  // is about to refuse. Asked of every accepted spelling rather than argued.
  for (const [written] of NORMALISED) {
    expect(wrong("dispatched", stored("dispatched", written))).toBeUndefined()
  }
})

test("a date with a clock face and NO offset is not canonical on disk", () => {
  // The door supplies the offset from the clock the write is stamped with; a
  // hand edit has no such door, so `2026-08-25T10:06:00` is a broken file
  // naming the key rather than a value the validator quietly accepts.
  expect(canonicalDate("2026-08-25T10:06:00", null)).toBeUndefined()
  expect(canonicalDate("2026-08-25T10:06:00", "-04:00")).toBe("2026-08-25T10:06:00-04:00")
  expect(wrong("dispatched", "2026-08-25T10:06:00")).toContain("write the offset too")
})

test("the offset comes from the clock the write is stamped with", () => {
  expect(offsetIn(NOW)).toBe("-04:00")
  expect(offsetIn("2026-08-25T14:06:00Z")).toBe("Z")
  expect(offsetIn("2026-08-25")).toBeUndefined()
})

test("a typed value is trimmed and a text one is not", () => {
  expect(stored("pr", "  193  ")).toBe("193")
  expect(stored("agent", " claude ")).toBe("claude")
  // Somebody's text, and a sentence that ends in a space is still that sentence.
  expect(stored("from", "  the human, over lunch  ")).toBe("  the human, over lunch  ")
})

test("an int and a path have one shape each, asked directly", () => {
  expect(isDigitRun("0")).toBe(true)
  expect(isDigitRun("193")).toBe(true)
  expect(isDigitRun("0193")).toBe(false)
  expect(isDigitRun("-1")).toBe(false)
  expect(isDigitRun("")).toBe(false)
  expect(isPathShaped(".worktrees/x")).toBe(true)
  expect(isPathShaped("a b")).toBe(false)
  expect(isPathShaped("")).toBe(false)
})

// ── where the recursion grounds ────────────────────────────────────────

test("the bootstrap table is the words a declaration says about itself", () => {
  expect([...BOOTSTRAP.keys()]).toEqual(["type", "under", "base"])
  // `type` is a closed word list — the seven kinds, and the union above is what
  // that list is checked against, so an eighth kind cannot be added to one
  // without the other.
  expect(PROP_KINDS).toEqual(["text", "date", "int", "path", "doc", "ref", "node"])
  // ...and so is `base`, for the same reason one word over: the two bases are a
  // fact about this format, so a vault cannot add a third by writing a node.
  expect(PATH_BASES).toEqual(["root", "file"])
})

test("a vault cannot declare `type`, `under` or `base` — the recursion stops in the table", () => {
  const claiming = derive(nodesOfFiles({
    ...FILES,
    "_olai/Properties.olai": `${FILES["_olai/Properties.olai"]}\n` +
      `{"id":"prop-type","ord":"a8","title":"type","custom":{"type":"int"}}\n` +
      `{"id":"prop-base","ord":"a9","title":"base","custom":{"type":"text"}}`,
  }))
  expect(declarationsOf(claiming).has("type")).toBe(false)
  expect(declarationsOf(claiming).has("base")).toBe(false)
})

test("a declaration the reading cannot make is skipped rather than guessed at", () => {
  // Each of these is reported against the declarations file itself
  // (`./validate.test.ts`); what matters here is that NONE of them makes the
  // key half-typed, which would refuse every value of it in a file nobody
  // edited.
  const bent = derive(nodesOfFiles({
    "_olai/Properties.olai": [
      `{"id":"p-1","ord":"a0","title":"nokind"}`,
      `{"id":"p-2","ord":"a1","title":"unknown","custom":{"type":"colour"}}`,
      `{"id":"p-3","ord":"a2","title":"stray","custom":{"type":"date","under":"nowhere"}}`,
      `{"id":"p-4","ord":"a3","title":"done","custom":{"type":"text"}}`,
      `{"id":"p-5","ord":"a4","title":"","custom":{"type":"text"}}`,
      `{"id":"p-6","ord":"a5","title":"twice","custom":{"type":"int"}}`,
      `{"id":"p-7","ord":"a6","title":"twice","custom":{"type":"date"}}`,
    ].join("\n"),
  }))
  // FIRST DECLARATION WINS among duplicates, which is `byId`'s rule for a
  // duplicate id and the same argument: the second claim is the mistake.
  expect([...declarationsOf(bent).keys()]).toEqual(["twice"])
  expect(declarationsOf(bent).get("twice")?.type).toEqual({ kind: "int" })
})

// ── the review's corners ───────────────────────────────────────────────

test("a MIRROR cannot be where a ref's variants live", () => {
  // grok and pi, from two directions. A placement has no children of its own,
  // so a declaration pointed at one used to be ACCEPTED, produce an empty
  // variant list, and then refuse every value of that key with "nothing is
  // declared under it YET" — a sentence about the wrong problem, in a file
  // nobody was looking at. It is refused where the mistake is made now.
  const bent = derive(nodesOfFiles({
    ...FILES,
    "_olai/Properties.olai":
      `{"id":"p","ord":"a0","title":"agent","custom":{"type":"ref","under":"a-mirror"}}`,
  }))
  // The key is NOT declared, so no value of it is refused for the wrong reason.
  expect(declarationsOf(bent).has("agent")).toBe(false)
  // ...and the declarations file itself is what says so.
  expect(wrongDeclaration(bent, bent.byId.get("p")!, new Set()))
    .toContain("is a mirror — a second placement rather than a node of its own")
})

test("a ref's variants are capped in the sentence, and the did-you-mean is not", () => {
  // A roster is DATA and a vault may grow one to two hundred nodes; a refusal
  // that listed them all would be the whole id space in one sentence, which is
  // the failure `notFound` already names about node ids. What must NOT be
  // capped is the near miss: the one id worth reading may be the hundredth.
  const many = Array.from(
    { length: 30 },
    (_, at) => `{"id":"agent-${at}","parent":"roster","ord":"a${at}","title":"agent ${at}"}`,
  )
  const big = derive(nodesOfFiles({
    "_olai/Properties.olai":
      `{"id":"p","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}`,
    "r.olai": [`{"id":"roster","ord":"a0","title":"the agents"}`, ...many].join("\n"),
  }))
  const said = wrongValue(
    { declarations: declarationsOf(big), derived: big, documents: new Set() },
    "a.olai",
    "agent",
    "agent-29x",
  )
  expect(said).toContain("and 22 more")
  expect(said).toContain("did you mean `agent-29`?")
})

test("a key is FOLDED, so the fence and the query grammar mean one word", () => {
  // pi's reconciliation: the map used to be keyed as written and read exactly
  // on the write path while `prop:PR` folded — so one spelling was a span and
  // the other was untyped. A record carrying `PR` is asking about `pr`.
  expect(wrong("PR", "#193")).toContain("is a whole number")
  expect(wrong("Pr", "193")).toBeUndefined()
  expect(stored("PR", "  193  ")).toBe("193")
  // ...and the sentence quotes the key AS THE RECORD WROTE IT, since that is
  // the word somebody has to go and find.
  expect(wrong("PR", "#193")).toContain("`PR`")
})

test("the declarations are read in LINE order, which is the order a duplicate is reported in", () => {
  // Two claims on one key whose `ord` disagrees with their line order. The
  // reading keeps the EARLIER LINE and the rule reports the later one, so a
  // vault is never told to fix the very line its values are checked against.
  const crossed = derive(nodesOfFiles({
    "_olai/Properties.olai": [
      `{"id":"p-first","ord":"a9","title":"pr","custom":{"type":"int"}}`,
      `{"id":"p-second","ord":"a0","title":"pr","custom":{"type":"date"}}`,
    ].join("\n"),
  }))
  expect(declarationsOf(crossed).get("pr")).toEqual({ type: { kind: "int" }, at: "p-first" })
})

test("a key declared twice differing only in case is one key declared twice", () => {
  const twice = derive(nodesOfFiles({
    "_olai/Properties.olai": [
      `{"id":"p1","ord":"a0","title":"merge","custom":{"type":"ref"}}`,
      `{"id":"p2","ord":"a1","title":"Merge","custom":{"type":"date"}}`,
    ].join("\n"),
  }))
  expect([...declarationsOf(twice).keys()]).toEqual(["merge"])
  expect(wrongDeclaration(twice, twice.byId.get("p2")!, new Set(["merge"])))
    .toContain("a property key is folded for case")
})
