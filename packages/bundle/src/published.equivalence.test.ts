import { vaultOf } from "@olai/format/testlib"
import { pinnedVault, vaultAt } from "@olai/format/testlib/scope"
import { expect, test } from "bun:test"

import { publishedOf } from "./published.testlib.ts"
import { documentProjection } from "olai-plugin-markdown/projection"
import { outlineProjection } from "olai-plugin-outlines/projection"
import { headProjection } from "olai-plugin-vault/projection"
import {
  differential,
  misplacing,
  publishedAsWalked,
  REFUSED,
  type Report,
  revisionsOf,
  type Step,
  stepsOver,
  swallowing,
  unminting,
} from "./published.testlib.ts"

const holds = (report: Report, floors: {
  readonly upserts: number
  readonly removes: number
  readonly reused: number
  readonly rebuilt: number
  readonly minted: number
}): void => {
  expect(report.divergences).toEqual([])
  expect(report.phantom).toBe(0)
  expect(report.upserts).toBeGreaterThan(floors.upserts)
  expect(report.removes).toBeGreaterThan(floors.removes)
  expect(report.reused).toBeGreaterThan(floors.reused)
  expect(report.rebuilt).toBeGreaterThan(floors.rebuilt)
  expect(report.minted).toBeGreaterThan(floors.minted)
}

const HOUSE = '{"id":"kitchen","ord":"a0","title":"kitchen"}'
const GARDEN = '{"id":"garden","ord":"a0","title":"garden"}'

const CORNERS: ReadonlyMap<string, string> = new Map([
  ["house.olai", HOUSE],
  ["garden.olai", GARDEN],
  ["wing.olai", '{"id":"wing","ord":"a0","title":"the wing"}'],
  ["wing/kitchen.olai", '{"id":"wingkitchen","ord":"a0","title":"the wing kitchen"}'],
  ["notes.md", "# hello"],
  ["report.html", ""],
  ["data/sales.csv", "a,b\n1,2"],
  ["art/handle.png", ""],
])

const CORNER_STEPS: ReadonlyArray<Step> = [
  { writes: [["house.olai", `${HOUSE}\n{"id":"sink","parent":"kitchen","ord":"a1","title":"sink"}`]] },
  { writes: [["notes.md", "# hello again"]] },
  { writes: [["report.html", ""]] },
  { writes: [["shed.olai", '{"id":"shed","ord":"a0","title":"the shed"}']] },
  { writes: [["aaa.md", "# first of all"]] },
  { writes: [["zzz.olai", '{"id":"zzz","ord":"a0","title":"last of all"}']] },
  { deletes: ["garden.olai"] },
  { writes: [["house.olai", '{"id":"kitchen"']] },
  { writes: [["house.olai", HOUSE]] },
  { writes: [["notes.md", REFUSED]] },
  { writes: [["notes.md", "# readable once more"]] },
  {},
  {
    writes: [
      ["house.olai", `${HOUSE}\n{"id":"pantry","parent":"kitchen","ord":"a2","title":"pantry"}`],
      ["wing.olai", '{"id":"wing","ord":"a0","title":"the wing, rebuilt"}'],
      ["notes.md", "# pulled"],
      ["wing/attic.olai", '{"id":"attic","ord":"a0","title":"the attic"}'],
    ],
    deletes: ["shed.olai"],
  },
  { deletes: ["aaa.md"] },
  { writes: [["aaa.md", "# back again"]] },
  { deletes: ["wing/kitchen.olai"] },
  {
    writes: [["swapped.md", "# what the outline used to say\n"]],
    deletes: ["house.olai"],
  },
  {
    writes: [["swapped.olai", '{"id":"swapped","ord":"a0","title":"back to records"}']],
    deletes: ["swapped.md"],
  },
  {
    writes: [["ghosted.md", "# arrived as the other one vanished\n"]],
    forgotten: ["swapped.olai"],
  },
  {
    writes: [["revived.olai", '{"id":"revived","ord":"a0","title":"revived"}']],
    deletes: ["report.html"],
  },
  { forgotten: ["zzz.olai"] },
  { forgotten: ["data/sales.csv"] },
  { writes: [["late.olai", '{"id":"late","ord":"a0","title":"arrived"}']], forgotten: ["wing/attic.olai"] },
  { writes: [["data/sales.csv", "a,b\n3,4"], ["art/handle.png", ""]] },
  { deletes: ["art/handle.png"] },
  {
    writes: [["revived.olai", '{"id":"revived","ord":"a0","title":"checked back out"}']],
    forgotten: ["aaa.md"],
  },
]

test("the corners a generator cannot reach publish the same frames", () => {
  holds(
    differential(CORNERS, CORNER_STEPS, publishedOf),
    { upserts: 20, removes: 3, reused: 10, rebuilt: 10, minted: 8 },
  )
})

test("the phantom is gone — and the pre-fix wire, wired back in, fails the same assertion", () => {
  const fixed = differential(CORNERS, CORNER_STEPS, publishedOf)
  expect(fixed.phantom).toBe(0)
  expect(fixed.minted).toBeGreaterThan(4)

  const before = differential(CORNERS, CORNER_STEPS, unminting(publishedOf))
  expect(before.phantom).toBeGreaterThan(0)
  expect(before.divergences.join("\n")).toContain("the delta a reader was offered")
  expect(before.divergences.join("\n")).toContain("still holds that a fresh one no longer reads")
})

const generated = (files: number, records: number): ReadonlyMap<string, string> => {
  const vault = new Map(vaultOf({ files, records }))
  for (let at = 0; at < files / 4; at++) {
    vault.set(`note${at}/page${at}.md`, `# page ${at}\n\nsome prose about the kitchen.\n`)
    if (at % 3 === 0) vault.set(`note${at}/saved${at}.html`, "")
    if (at % 5 === 0) vault.set(`note${at}/data${at}.csv`, "a,b\n1,2")
  }
  return vault
}

test("a generated vault under two hundred writes publishes the same frames", () => {
  const vault = generated(120, 20)
  const { steps, resyncs } = stepsOver([...vault.keys()], { steps: 200 })
  expect(vault.size).toBeGreaterThan(140)
  expect(steps.length).toBeGreaterThan(200)
  expect(resyncs).toBeGreaterThan(3)
  holds(
    differential(vault, steps, publishedOf),
    { upserts: 300, removes: 10, reused: 200, rebuilt: 40, minted: 4 },
  )
}, { timeout: 60_000 })

const VAULT = pinnedVault()

test("the real vault, edited, publishes the same frames", () => {
  const vault = vaultAt(VAULT)
  expect(vault.size).toBeGreaterThan(10)
  const { steps, resyncs } = stepsOver([...vault.keys()], { steps: 80, seed: 77 })
  expect(resyncs).toBeGreaterThan(1)
  holds(
    differential(vault, steps, publishedOf),
    { upserts: 100, removes: 3, reused: 80, rebuilt: 20, minted: 2 },
  )
}, { timeout: 30_000 })

test("a reused shell that swallows a delta is caught, and named", () => {
  const report = differential(CORNERS, CORNER_STEPS, swallowing(publishedOf))
  expect(report.divergences.length).toBeGreaterThan(0)
  expect(report.divergences.join("\n")).toContain("the delta a reader was offered")
  expect(report.divergences.join("\n")).toContain("the delta a reader accepted")
})

test("a born key appended rather than placed is caught by the snapshot alone", () => {
  const report = differential(CORNERS, CORNER_STEPS, misplacing(publishedOf))
  expect(report.divergences.length).toBeGreaterThan(0)
  expect(report.divergences.join("\n")).toContain("`readAll` of heads at revision")
  expect(report.divergences.join("\n")).not.toContain("the delta a reader")
})

test("the reference agrees with itself, so a divergence is never the harness", () => {
  const report = differential(CORNERS, CORNER_STEPS, publishedAsWalked)
  expect(report.divergences).toEqual([])
  expect(report.reused).toBe(0)
})

test("a write moves the file's entry and nothing else's, in every collection", () => {
  const revisions = revisionsOf(CORNERS, [
    { writes: [["house.olai", `${HOUSE}\n{"id":"sink","parent":"kitchen","ord":"a1","title":"sink"}`]] },
    { writes: [["notes.md", "# hello again"]] },
  ])
  const first = publishedOf(revisions[0]!, null)
  const wasHouse = first.outlines.entries.get("house.olai")
  const wasWing = first.outlines.entries.get("wing.olai")
  const wasNotesHead = first.heads.entries.get("notes.md")

  const second = publishedOf(revisions[1]!, first)
  expect(second.outlines.upserts.map(([path]) => path)).toEqual(["house.olai"])
  expect(second.outlines.entries.get("house.olai")).not.toBe(wasHouse)
  expect(second.outlines.entries.get("house.olai")?.rev).toBe(2)
  expect(second.outlines.upserts[0]?.[1]).toBe(second.outlines.entries.get("house.olai")!)
  expect(second.heads.upserts.map(([path]) => path)).toEqual(["house.olai"])
  expect(second.outlines.entries.get("wing.olai")).toBe(wasWing!)
  expect(second.heads.entries.get("notes.md")).toBe(wasNotesHead!)
  expect(second.documents.upserts).toEqual([])

  const third = publishedOf(revisions[2]!, second)
  expect(third.documents.upserts.map(([path]) => path)).toEqual(["notes.md"])
  const notes = third.documents.entries.get("notes.md")
  expect(notes?.state === "served" && notes.text).toBe("# hello again")
  expect(third.heads.entries.get("notes.md")).not.toBe(wasNotesHead)
  expect(third.outlines.upserts).toEqual([])
})

test("independent capability projections preserve the complete revision corpus", () => {
  let outlines: ReturnType<typeof outlineProjection> | undefined
  let documents: ReturnType<typeof documentProjection> | undefined
  let heads: ReturnType<typeof headProjection> | undefined
  const project: typeof publishedOf = snapshot => {
    outlines = outlineProjection(snapshot, outlines)
    documents = documentProjection(snapshot, documents)
    heads = headProjection(snapshot, heads)
    return { outlines: outlines.change, documents: documents.change, heads: heads.change }
  }
  holds(differential(CORNERS, CORNER_STEPS, project),
    { upserts: 20, removes: 3, reused: 10, rebuilt: 10, minted: 8 })
})
