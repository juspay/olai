import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { assemble, type Bodied, bodiedDocument, bodiedIn, bodyKind, type Document, isMirror, type Located, matching, matchingDocuments, nodesIn, parseFilter, reading, type Reading, type Scope, type Verdict, verdictOf } from "@olai/format"
import { parseOutline } from "olai-plugin-outline-olai/format"
import { seeded, vaultOf } from "@olai/format/testlib"
import { Result } from "effect"

import { CROWD_FLOOR, type Index, open } from "./table.ts"

const TODAY = "2026-08-13"
const NOW = `${TODAY}T11:00:00-04:00`

const same = (
  at: Reading,
  index: Index,
  text: string,
  scope: Scope = {},
): { readonly narrowed: boolean; readonly hits: number } => {
  const filter = parseFilter(text, NOW)
  const walked = matching(at.derived, filter, scope)
  const walkedDocuments = matchingDocuments(bodiedIn(at.set), filter, scope)

  const candidates = index.narrow(at, filter)
  const indexed = matching(at.derived, filter, scope, candidates?.nodes)
  const indexedDocuments = matchingDocuments(
    bodiedIn(at.set),
    filter,
    scope,
    candidates?.documents,
  )

  if (candidates !== null) {
    expect(walked.filter((one) => !candidates.nodes.has(one.at.node.id)).map((one) =>
      one.at.node.id
    )).toEqual([])
    expect(
      walkedDocuments.filter((one) => !candidates.documents.has(one.at.path)).map((one) =>
        one.at.path
      ),
    ).toEqual([])
  }
  expect(indexed).toEqual(walked)
  expect(indexedDocuments).toEqual(walkedDocuments)
  return {
    narrowed: candidates !== null,
    hits: walked.length + walkedDocuments.length,
  }
}

const opened = (): Index => open()

const NUL = String.fromCharCode(0)
const LONE = String.fromCharCode(0xd83d)

const HAND = {
  "house.olai": [
    `{"id":"house","ord":"a0","title":"House #home"}`,
    `{"id":"kitchen","parent":"house","ord":"a1","title":"Remodel the kitchen","desc":"walnut cabinets and a new sink","todo":true,"date":"2026-08-14","custom":{"pr":"#258","agent":"claude-opus"}}`,
    `{"id":"chen","parent":"house","ord":"a2","title":"Ask chen remodelling costs","done":"2026-08-10T09:00:00-04:00"}`,
    `{"id":"cafe","parent":"house","ord":"a3","title":"Café ÉCOLE naïve straße","desc":"日本語 の ノート"}`,
    `{"id":"emoji","parent":"house","ord":"a4","title":"a😀b party @alice","created":"2026-08-01T08:00:00-04:00"}`,
    `{"id":"tiny","parent":"house","ord":"a5","title":"ab","desc":"xy"}`,
    `{"id":"quoted","parent":"house","ord":"a6","title":"one two three","after":["kitchen"]}`,
    JSON.stringify({
      id: "hostile",
      parent: "house",
      ord: "a7",
      title: `before${NUL}afterword and ab${LONE}cd`,
      desc: `tail${NUL}prose about lacquer`,
    }),
  ].join("\n"),
  "work.olai": [
    `{"id":"work","ord":"a0","title":"Work #office"}`,
    `{"id":"invoice","parent":"work","ord":"a1","title":"Send the invoice","todo":true,"changed":"2026-08-13T10:30:00-04:00"}`,
    `{"id":"mirror-kitchen","parent":"work","ord":"a2","mirror":"kitchen"}`,
  ].join("\n"),
  "_olai/Trash.olai": [
    `{"id":"gone","ord":"a0","title":"Old kitchen plan","desc":"walnut, once"}`,
  ].join("\n"),
} as const

const DOCUMENTS: ReadonlyArray<readonly [string, string]> = [
  [
    "notes/cabinets.md",
    "---\nagent: claude-opus\ntags: [\"#home\"]\n---\n\nThe walnut cabinets, and what the kitchen costs.\n",
  ],
  ["notes/Café.md", "École and a naïve note about straße.\n"],
  ["notes/empty.md", "nothing much here\n"],
]

const UNKEPT = "pages/kitchen-inspiration.html"

const handVault = (): Reading =>
  reading(TEST_CLAIMS,
    assemble(TEST_CLAIMS,
      new Map<string, Result.Result<Document, Verdict>>([
        ...Object.entries(HAND).map(
          ([file, text]) =>
            [file, Result.mapError(parseOutline(file, text, TEST_CLAIMS), verdictOf)] as [
              string,
              Result.Result<Document, Verdict>,
            ],
        ),
        ...DOCUMENTS.map(
          ([path, text]) =>
            [path, Result.succeed<Document>(bodiedDocument(TEST_CLAIMS, path, text))] as const,
        ),
        [UNKEPT, Result.succeed<Document>(bodiedDocument(TEST_CLAIMS, UNKEPT, null))],
      ]),
    ),
  )

const CORNERS: ReadonlyArray<string> = [
  "remo",
  "kitchen",
  "chen remo",
  `"the kitchen"`,
  `"remodel the"`,
  "walnut cabinets",
  "kitchen walnut",
  "kitchen OR invoice",
  "kitchen OR zzzzz",
  "zzzzz OR qqqqq",
  "walnut kitchen OR invoice",
  "ab",
  "a",
  "xy",
  "cab",
  "-walnut",
  "kitchen -walnut",
  "kitchen -zzzzz",
  "is:done",
  "is:todo",
  "is:marked",
  "is:blocked",
  "is:mirrored",
  "has:desc",
  "has:date",
  "date:2026-08-14",
  "date:2026-08-01..2026-08-20",
  "created:2026-08",
  "changed:2026-08-13",
  "prop:pr",
  "prop:agent=claude-opus",
  "prop:agent=nobody",
  "kitchen is:todo",
  "kitchen is:done",
  "remodelling is:done",
  "walnut has:desc",
  "cabinets prop:agent=claude-opus",
  "walnut is:trashed",
  "plan is:trashed",
  "plan",
  "-is:trashed walnut",
  "REMODEL",
  "KiTcHeN",
  "café",
  "CAFÉ",
  "école",
  "ÉCOLE",
  "naïve",
  "straße",
  "日本語",
  "ノート",
  "a😀b",
  "😀b",
  "😀",
  "#home",
  "home",
  "alice",
  "@alice",
  "cabinets",
  "notes/",
  "inspiration",
  "kitchen-inspiration",
  "nothing much",
  "afterword",
  "lacquer",
  `before${NUL}after`,
  `tail${NUL}prose`,
  `ab${LONE}cd`,
  `b${LONE}c`,
  "zzzzzzzz",
  "",
  "is:open",
  "date:soon",
]

test("index and corpus answer the grammar's corners identically", () => {
  const index = opened()
  const at = handVault()
  let narrowed = 0
  let found = 0
  try {
    for (const text of CORNERS) {
      const answer = same(at, index, text)
      if (answer.narrowed) narrowed += 1
      found += answer.hits
    }
  } finally {
    index.close()
  }
  expect(narrowed).toBeGreaterThan(30)
  expect(found).toBeGreaterThan(40)
})

test("a scope narrows the same records whichever way the candidates came", () => {
  const index = opened()
  const at = handVault()
  try {
    for (const text of ["kitchen", "remo", "walnut", "cabinets", "house"]) {
      same(at, index, text, { file: "house.olai" })
      same(at, index, text, { file: "work.olai" })
      same(at, index, text, { under: "house" })
      same(at, index, text, { under: "work" })
      same(at, index, text, { under: "kitchen" })
      same(at, index, text, { trashed: true })
    }
  } finally {
    index.close()
  }
})

test("a needle under the trigram floor is not asked of the index at all", () => {
  const index = opened()
  const at = handVault()
  try {
    for (const text of ["ab", "a", "😀", "ab OR kitchen"]) {
      expect(index.narrow(at, parseFilter(text, NOW))).toBeNull()
    }
    expect(index.narrow(at, parseFilter("abc", NOW))).not.toBeNull()
    expect(index.narrow(at, parseFilter("a😀b", NOW))).not.toBeNull()
    for (const text of [`before${NUL}after`, `ab${LONE}cd`, `b${LONE}c`]) {
      expect(index.narrow(at, parseFilter(text, NOW))).toBeNull()
    }
    expect(index.narrow(at, parseFilter("😀 kitchen", NOW))?.nodes).toEqual(
      index.narrow(at, parseFilter("kitchen", NOW))?.nodes as ReadonlySet<string>,
    )
  } finally {
    index.close()
  }
})

test("the index holds one row per record and document, and no more", () => {
  const index = opened()
  const at = handVault()
  try {
    index.narrow(at, parseFilter("kitchen", NOW))
    expect(index.rows()).toBe(recordCount(at) + bodiedIn(at.set).length)
  } finally {
    index.close()
  }
})

const WORDS = [
  "kitchen",
  "garden",
  "invoice",
  "walnut",
  "budget",
  "remodel",
  "café",
  "straße",
  "日本語",
  "upkeep",
  "ab",
  "brass",
]

const TAGS = ["#home", "#office", "#later"]

const EVERYWHERE = "item"

const fileOf = (
  random: () => number,
  at: number,
  records: number,
  props: boolean,
): string => {
  const root = `f${at}r`
  const lines = [
    JSON.stringify({ id: root, ord: "a0", title: `file ${at} ${EVERYWHERE} ${pick(random)}` }),
  ]
  for (let which = 1; which < records; which++) {
    const record: Record<string, unknown> = {
      id: `f${at}n${which}`,
      parent: root,
      ord: `a${which}`,
      title: `${pick(random)} ${EVERYWHERE} ${pick(random)} ${which} ${
        TAGS[Math.floor(random() * TAGS.length)] as string
      }`,
    }
    if (random() < 0.3) record["todo"] = true
    else if (random() < 0.2) record["done"] = `2026-08-0${which % 9}T09:00:00-04:00`
    if (random() < 0.25) record["desc"] = `a note about ${pick(random)} and ${pick(random)}`
    if (random() < 0.2) record["date"] = `2026-08-${String((which % 28) + 1).padStart(2, "0")}`
    if (props) record["custom"] = { agent: pick(random), pr: `#${which}` }
    lines.push(JSON.stringify(record))
  }
  return lines.join("\n")
}

const pick = (random: () => number): string =>
  WORDS[Math.floor(random() * WORDS.length)] as string

const linesOf = (text: string): Array<Record<string, unknown>> =>
  text.split("\n").filter((line) => line !== "").map(
    (line) => JSON.parse(line) as Record<string, unknown>,
  )

const textOf = (lines: ReadonlyArray<Record<string, unknown>>): string =>
  lines.map((line) => JSON.stringify(line)).join("\n")

const POOL: ReadonlyArray<string> = [
  "kitchen",
  "garden",
  "walnut budget",
  "kitchen OR garden",
  "café",
  "straße",
  "日本語",
  "upkeep is:todo",
  "note about",
  `"a note about"`,
  "ab",
  "remodel -walnut",
  "is:done",
  "has:desc",
  "date:2026-08-14",
  "prop:agent",
  "brass prop:pr",
  "file 3",
  "zzzzzzzz",
  "#home",
  "office",
  EVERYWHERE,
]

const recordCount = (at: Reading): number => {
  let count = 0
  for (const [, records] of at.derived.byFile) {
    for (const one of records) if (!isMirror(one.node)) count += 1
  }
  return count
}

const claimCount = (at: Reading): number => {
  let count = 0
  for (const [, records] of at.derived.byFile) count += records.length
  return count
}

test("index and corpus stay in step through a soak that crosses the decline threshold", () => {
  const index = opened()
  try {
    const random = seeded(20260824)
    const RECORDS = 9

    const PHASES = [
      { files: 40, rounds: 10, declines: false },
      { files: 130, rounds: 14, declines: true },
      { files: 40, rounds: 12, declines: false },
    ] as const

    const decoded = new Map<string, Result.Result<Document, Verdict>>()
    const texts = new Map<string, string>()
    let minted = 0
    let rewrites = 0

    const filed = (path: string, text: string): string => {
      texts.set(path, text)
      decoded.set(path, Result.mapError(parseOutline(path, text, TEST_CLAIMS), verdictOf))
      return path
    }
    const mintFile = (): string => {
      const at = minted++
      return filed(`note${at}.olai`, fileOf(random, at, RECORDS, at % 2 === 0))
    }
    const unfiled = (path: string): void => {
      texts.delete(path)
      decoded.delete(path)
    }

    for (let at = 0; at < PHASES[0].files; at++) mintFile()
    for (let at = 0; at < 6; at++) {
      const path = `doc${at}.md`
      decoded.set(
        path,
        Result.succeed<Document>(
          bodiedDocument(TEST_CLAIMS, path, `---\nagent: ${pick(random)}\n---\n\nprose about ${pick(random)}\n`),
        ),
      )
    }

    let read = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded))
    let narrowed = 0
    let found = 0
    let declined = 0
    let answered = 0
    const shapes = {
      rewrite: 0,
      remove: 0,
      mint: 0,
      document: 0,
      rename: 0,
      move: 0,
      mirror: 0,
    }
    let round = 0

    for (const phase of PHASES) {
      for (let step = 0; step < phase.rounds; step++) {
        round += 1
        const changed: Array<string> = []
        const removed: Array<string> = []
        const outlines = [...decoded.keys()].filter((path) => bodyKind(TEST_CLAIMS, path) === null)
        const markdown = [...decoded.keys()].filter((path) => bodyKind(TEST_CLAIMS, path) !== null)
        const living = (): ReadonlyArray<string> => outlines.filter((path) => texts.has(path))

        const owed = phase.files - outlines.length
        const moves = Math.abs(owed) > 12 ? Math.min(24, Math.abs(owed)) : 1 + Math.floor(random() * 3)

        for (let move = 0; move < moves; move++) {
          if (owed > 12) {
            changed.push(mintFile())
            shapes.mint += 1
            continue
          }
          const alive = living()
          if (owed < -12 && alive.length > 4) {
            const path = alive[move % alive.length] as string
            unfiled(path)
            removed.push(path)
            shapes.remove += 1
            continue
          }
          if (alive.length === 0) continue

          const roll = random()
          const anOutline = (): string => alive[Math.floor(random() * alive.length)] as string

          if (roll < 0.34) {
            rewrites += 1
            changed.push(
              filed(anOutline(), fileOf(random, minted++, RECORDS, rewrites % 2 === 0)),
            )
            shapes.rewrite += 1
          } else if (roll < 0.44 && alive.length > 4) {
            const path = anOutline()
            unfiled(path)
            removed.push(path)
            shapes.remove += 1
          } else if (roll < 0.54) {
            changed.push(mintFile())
            shapes.mint += 1
          } else if (roll < 0.64 && markdown.length > 0) {
            const path = markdown[Math.floor(random() * markdown.length)] as string
            decoded.set(
              path,
              Result.succeed<Document>(
                bodiedDocument(TEST_CLAIMS,
                  path,
                  `---\nagent: ${pick(random)}\n---\n\nprose about ${pick(random)} and ${
                    pick(random)
                  }\n`,
                ),
              ),
            )
            changed.push(path)
            shapes.document += 1
          } else if (roll < 0.76) {
            const from = anOutline()
            const text = texts.get(from) as string
            unfiled(from)
            removed.push(from)
            changed.push(filed(`moved${minted++}.olai`, text))
            shapes.rename += 1
          } else if (roll < 0.88 && alive.length > 1) {
            const from = anOutline()
            const to = anOutline()
            if (from !== to) {
              const out = linesOf(texts.get(from) as string)
              const into = linesOf(texts.get(to) as string)
              const root = into[0]
              if (out.length > 2 && root !== undefined) {
                const carried = out.pop() as Record<string, unknown>
                carried["parent"] = root["id"]
                carried["ord"] = `y${into.length}`
                into.push(carried)
                changed.push(filed(from, textOf(out)), filed(to, textOf(into)))
                shapes.move += 1
              }
            }
          } else {
            const into = anOutline()
            const target = [...read.derived.byId].find(([, at]) =>
              at.file !== into && !isMirror(at.node)
            )
            const lines = linesOf(texts.get(into) as string)
            const root = lines[0]
            if (target !== undefined && root !== undefined) {
              lines.push({
                id: `m${minted++}`,
                parent: root["id"],
                ord: `y${lines.length}`,
                mirror: target[0],
              })
              changed.push(filed(into, textOf(lines)))
              shapes.mirror += 1
            }
          }
        }
        if (changed.length + removed.length === 0) continue

        const set = assemble(TEST_CLAIMS, decoded)
        read = round % 7 === 6 ? reading(TEST_CLAIMS, set) : reading(TEST_CLAIMS, set, {
          read,
          delta: {
            upserts: [...new Set(changed)].map(
              (file) =>
                [file, { nodes: nodesIn(decoded.get(file)) as ReadonlyArray<Located> }] as const,
            ),
            removes: removed,
          },
        })

        expect(read.derived.byId.size).toBe(claimCount(read))

        for (const text of POOL) {
          const answer = same(read, index, text)
          if (answer.narrowed) narrowed += 1
          found += answer.hits
        }
        expect(index.rows()).toBe(recordCount(read) + bodiedIn(read.set).length)

        if (index.narrow(read, parseFilter(EVERYWHERE, NOW)) === null) declined += 1
        else answered += 1
      }

      expect(recordCount(read) > CROWD_FLOOR).toBe(phase.declines)
      expect(index.narrow(read, parseFilter(EVERYWHERE, NOW)) === null).toBe(phase.declines)
      expect(same(read, index, EVERYWHERE).hits).toBeGreaterThan(0)
    }

    expect(declined).toBeGreaterThan(5)
    expect(answered).toBeGreaterThan(5)
    expect(Object.entries(shapes).filter(([, count]) => count === 0)).toEqual([])
    expect(narrowed).toBeGreaterThan(round * 5)
    expect(found).toBeGreaterThan(round * 5)
  } finally {
    index.close()
  }
}, 30_000)

test("index and corpus agree over a generated vault", () => {
  const index = opened()
  try {
    const corpus = vaultOf({ files: 120, records: 12 })
    const decoded = new Map<string, Result.Result<Document, Verdict>>()
    for (const [path, text] of corpus) {
      decoded.set(path, Result.mapError(parseOutline(path, text, TEST_CLAIMS), verdictOf))
    }
    const at = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded))
    const held = recordCount(at)
    const selective = index.narrow(at, parseFilter(`"of file 11"`, NOW))
    expect(selective?.nodes.size ?? held).toBeLessThan(held / 5)
    // Declining may not change an answer, only a cost.
    expect(index.narrow(at, parseFilter("record", NOW))).toBeNull()
    let found = 0
    for (
      const text of [
        "record",
        "record 3",
        "file 1",
        "upkeep",
        "note about",
        `"a note about"`,
        "upkeep1 OR upkeep2",
        "record is:todo",
        "zzzzzzzz",
        "of file 11",
      ]
    ) {
      found += same(at, index, text).hits
    }
    expect(found).toBeGreaterThan(0)
  } finally {
    index.close()
  }
})

test("a document that leaves takes its row with it", () => {
  const index = opened()
  try {
    const decoded = new Map<string, Result.Result<Document, Verdict>>([
      [
        "a.olai",
        Result.mapError(
          parseOutline("a.olai", `{"id":"one","ord":"a0","title":"a kitchen row"}`, TEST_CLAIMS),
          verdictOf,
        ),
      ],
      ["note.md", Result.succeed<Document>(bodiedDocument(TEST_CLAIMS, "note.md", "kitchen prose"))],
    ])
    const before = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded))
    expect(same(before, index, "kitchen").hits).toBe(2)

    decoded.delete("note.md")
    const after = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded), {
      read: before,
      delta: { upserts: [], removes: ["note.md"] },
    })
    expect(same(after, index, "kitchen").hits).toBe(1)
    expect(index.rows()).toBe(1)
  } finally {
    index.close()
  }
})

test("a file the set holds the path of is findable by name and not by prose", () => {
  const index = opened()
  const at = handVault()
  try {
    const named = same(at, index, "inspiration")
    expect(named.hits).toBe(1)
    const bodied: ReadonlyArray<Bodied> = bodiedIn(at.set)
    expect(bodied.map((one) => one.path as string)).toContain(UNKEPT)
  } finally {
    index.close()
  }
})
