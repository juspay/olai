import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import { ApplyRequest, BATCH_AT_MOST, type BatchedRequest, byPath, derive, nodesOf, type OutlineSet, outlinePaths, WriteRequest, type WriteRequest as Request } from "@olai/format"
import { serializeOutline } from "olai-plugin-outline-olai/format"
import { recordsOf } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { fileOf, planned, record, refused, setOf, STAMP } from "./fixtures.testlib.ts"

const KITCHEN = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","todo":true}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","todo":true}`,
  `{"id":"loose","ord":"a1","title":"a node with no children"}`,
].join("\n")

const house = (): OutlineSet => setOf({ "house.olai": KITCHEN })

const batch = (...ops: ReadonlyArray<BatchedRequest>): Request => ({ op: "apply", ops })

const after = (set: OutlineSet, request: Request): OutlineSet => {
  const texts = Object.fromEntries(
    outlinePaths(set).map((file) => [
      file,
      serializeOutline(
        nodesOf(derive(TEST_CLAIMS, recordsOf(set)), file).map((located) => located.node),
      ),
    ]),
  )
  for (const file of planned(set, request).files) {
    texts[file.file] = serializeOutline(file.nodes)
  }
  return setOf(texts)
}

describe("a capture carries its edges and its facts", () => {
  test("a child waits on a sibling declared LATER in the same call", () => {
    const result = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "wire the lane",
      children: [
        { id: "step-2", title: "fit them", waitsOn: ["step-1"] },
        { id: "step-1", title: "order them" },
      ],
    })
    const nodes = fileOf(result, "house.olai")
    expect(record(nodes, "step-2").after).toEqual(["step-1"])
    expect(record(nodes, "step-1").after).toBeUndefined()
    expect(result.captured).toEqual([
      { id: "n1", title: "wire the lane" },
      { id: "step-2", title: "fit them" },
      { id: "step-1", title: "order them" },
    ])
  })

  test("edges may name nodes the set already holds, and `see` alongside", () => {
    const result = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "fit the worktop",
      waitsOn: ["install"],
      see: ["order"],
    })
    expect(record(fileOf(result, "house.olai"), "n1")).toMatchObject({
      after: ["install"],
      see: ["order"],
    })
  })

  test("properties are written through the same writer `outlines_prop` reaches", () => {
    const result = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      props: { pr: "https://x/1", agent: "claude-opus", blank: "" },
    })
    expect(record(fileOf(result, "house.olai"), "n1").custom)
      .toEqual({ pr: "https://x/1", agent: "claude-opus" })
  })

  test("a target named twice is named once", () => {
    const result = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      waitsOn: ["order", "order", "install"],
    })
    expect(record(fileOf(result, "house.olai"), "n1").after).toEqual(["order", "install"])
  })

  test("a `props` key spelled like a field is refused in `outlines_prop`'s words", () => {
    const failure = refused(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      props: { done: "yesterday" },
    })
    expect(failure.message).toBe(
      refused(house(), { op: "prop", id: "order", key: "done", value: "yesterday" }).message,
    )
  })

  test("an unknown target is refused with the closest id — the minted ones included", () => {
    const stray = refused(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      waitsOn: ["instal"],
    })
    expect(stray._tag).toBe("NotFoundFailure")
    expect(stray.message).toContain("`instal` is not a node in the loaded set")
    expect(stray.message).toContain("install")

    const near = refused(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      children: [
        { id: "measure-up", title: "measure up" },
        { title: "cut", waitsOn: ["measure-ip"] },
      ],
    })
    expect(near.message).toContain("measure-up")
  })

  test("`after` on a captured node is REFUSED, not dropped, naming the bend", () => {
    const failure = refused(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      children: [{ title: "cut", after: ["order"] } as unknown as never],
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`cut` carries `after`")
    expect(failure.message).toContain("write `waitsOn` instead")
    expect(failure.message).toContain("Nothing was written.")

    const placed = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      after: "demo",
    })
    expect(record(fileOf(placed, "house.olai"), "n1").title).toBe("lane")

    const seeded = refused(house(), {
      op: "create",
      file: "lane.olai",
      seed: { title: "lane", after: ["order"] } as unknown as never,
    })
    expect(seeded.message).toContain("write `waitsOn` instead")
  })

  test("the walk that finds it stops where the schema stopped", () => {
    const failure = refused(house(), {
      op: "add",
      parent: "kitchen",
      title: "deep",
      children: [{
        title: "one",
        children: [{
          title: "two",
          children: [{ title: "three", children: 5 } as unknown as never],
        }],
      }],
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("nests at most 3 levels of `children`")
  })

  test("a loop drawn entirely inside the capture is refused naming it", () => {
    const failure = refused(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      children: [
        { id: "a", title: "a", waitsOn: ["b"] },
        { id: "b", title: "b", waitsOn: ["a"] },
      ],
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("closes a loop")
    expect(failure.message).toMatch(/`a` → `b` → `a`|`b` → `a` → `b`/)
  })

  test("a loop closing through the set is refused naming it, as `outlines_after` would", () => {
    const wired = setOf({
      "house.olai": KITCHEN.replace(
        `"title":"install them","todo":true}`,
        `"title":"install them","todo":true,"after":["order"]}`,
      ),
    })
    const failure = refused(wired, {
      op: "apply",
      ops: [
        { op: "add", parent: "kitchen", id: "worktop", title: "worktop", waitsOn: ["install"] },
        { op: "after", id: "order", add: ["worktop"] },
      ],
    })
    expect(failure.message).toContain("closes a loop")
    expect(failure.message).toContain("`order` → `worktop` → `install` → `order`")
  })

  test("a seed carries them too — a new outline arrives wired", () => {
    const result = planned(house(), {
      op: "create",
      file: "lane.olai",
      seed: {
        title: "lane",
        props: { agent: "claude-opus" },
        children: [
          { id: "s2", title: "second", waitsOn: ["s1"] },
          { id: "s1", title: "first" },
        ],
      },
    })
    const nodes = fileOf(result, "lane.olai")
    expect(record(nodes, "n1").custom).toEqual({ agent: "claude-opus" })
    expect(record(nodes, "s2").after).toEqual(["s1"])
  })

  test("a capture may arrive `doing` and blocked — the discovery, not the instruction", () => {
    const result = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "fit the worktop",
      mark: "doing",
      waitsOn: ["order"],
    })
    expect(record(fileOf(result, "house.olai"), "n1")).toMatchObject({
      doing: true,
      after: ["order"],
    })
  })
})

describe("apply", () => {
  test("several ops become one plan, one file, one subject", () => {
    const result = planned(
      house(),
      batch(
        { op: "done", id: "order" },
        { op: "prop", id: "install", key: "pr", value: "https://x/1" },
        { op: "title", id: "loose", title: "renamed" },
      ),
    )
    expect(result.files).toHaveLength(1)
    const nodes = fileOf(result, "house.olai")
    expect(record(nodes, "order").done).toBe(STAMP)
    expect(record(nodes, "install").custom).toEqual({ pr: "https://x/1" })
    expect(record(nodes, "loose").title).toBe("renamed")
    expect(result.summary).toContain("apply: 3 ops")
    expect(result.summary).toContain("done: order the cabinets")
    expect(result.id).toBe("loose")
  })

  test("a later op names a node an earlier one created", () => {
    const result = planned(
      house(),
      batch(
        { op: "add", parent: "kitchen", id: "worktop", title: "fit the worktop" },
        { op: "after", id: "worktop", add: ["install"] },
        { op: "prop", id: "worktop", key: "agent", value: "claude-opus" },
      ),
    )
    expect(record(fileOf(result, "house.olai"), "worktop")).toMatchObject({
      after: ["install"],
      custom: { agent: "claude-opus" },
    })
    expect(result.captured).toEqual([{ id: "worktop", title: "fit the worktop" }])
  })

  test("a refusal anywhere aborts everything, naming the index and the kind", () => {
    const failure = refused(
      house(),
      batch(
        { op: "done", id: "order" },
        { op: "done", id: "nowhere" },
        { op: "done", id: "install" },
      ),
    )
    expect(failure.message).toContain("`ops[1]` (`done`)")
    expect(failure.message).toContain("nothing in this batch was written")
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("`nowhere` is not a node in the loaded set")
    expect((failure as { named?: string }).named).toBe("nowhere")
  })

  test("the done-over-open-work gate refuses exactly as `outlines_done` would", () => {
    const alone = refused(house(), { op: "done", id: "kitchen" })
    const batched = refused(house(), batch({ op: "done", id: "kitchen" }))
    expect(batched.message).toBe(`\`ops[0]\` (\`done\`) was refused, so nothing in ` +
      `this batch was written: ${alone.message}`)
    expect(alone.message).toContain("holds 2 unfinished tasks")
  })

  test("…and identically when the batch is what MADE the work unfinished", () => {
    const filed = { op: "add", parent: "loose", id: "chase", title: "chase it", mark: "todo" }
    const batched = refused(house(), batch(filed as BatchedRequest, { op: "done", id: "loose" }))
    expect(batched.message).toContain("`chase it` (`chase`, todo)")

    const alone = refused(after(house(), filed as Request), { op: "done", id: "loose" })
    expect(batched.message).toBe(
      `\`ops[1]\` (\`done\`) was refused, so nothing in this batch was written: ` +
        alone.message,
    )
  })

  test("a batch that finishes the branch first may then mark it done", () => {
    const result = planned(
      house(),
      batch(
        { op: "done", id: "order" },
        { op: "done", id: "install" },
        { op: "done", id: "kitchen" },
      ),
    )
    expect(record(fileOf(result, "house.olai"), "kitchen").done).toBe(STAMP)
  })

  test("`outlines_doing` after `outlines_after` in one batch meets the same gate", () => {
    const failure = refused(
      house(),
      batch(
        { op: "after", id: "loose", add: ["order"] },
        { op: "doing", id: "loose" },
      ),
    )
    expect(failure.message).toContain("`ops[1]` (`doing`)")
    expect(failure.message).toContain("comes after 1 unfinished task")
  })

  test("an empty list and an over-long one are both refused", () => {
    expect(refused(house(), batch()).message).toContain("give at least one op")
    const many = Array.from(
      { length: BATCH_AT_MOST + 1 },
      (): BatchedRequest => ({ op: "title", id: "loose", title: "x" }),
    )
    expect(refused(house(), batch(...many)).message)
      .toContain(`at most ${BATCH_AT_MOST} ops`)
  })

  test("the nudges of every op ride one answer", () => {
    const done = setOf({
      "house.olai": KITCHEN.replace(
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel","done":"2026-08-01"}`,
      ),
    })
    const result = planned(
      done,
      batch(
        { op: "add", parent: "kitchen", title: "chase the fitter", mark: "todo" },
        { op: "add", parent: "kitchen", title: "chase the joiner", mark: "todo" },
      ),
    )
    expect(result.nudge).toContain("`Kitchen remodel` was marked done")
    expect(result.nudge?.match(/marked done over work/g)).toHaveLength(1)
    expect(record(fileOf(result, "house.olai"), "kitchen").done).toBeUndefined()
  })

  test("an op after an archive is planned against the file the archive made", () => {
    const result = planned(
      house(),
      batch(
        { op: "trash", id: "order" },
        { op: "title", id: "order", title: "order the walnut cabinets" },
      ),
    )
    expect(result.files.map((one) => one.file).sort()).toEqual([
      "_olai/Trash.olai",
      "house.olai",
    ])
    expect(record(fileOf(result, "_olai/Trash.olai"), "order").title)
      .toBe("order the walnut cabinets")
    expect(fileOf(result, "house.olai").some((one) => one.id === "order")).toBe(false)
  })

  test("the fold and the patcher agree about a file beside a directory", () => {
    const wing = setOf({
      "wing.olai": `{"id":"wing","ord":"a0","title":"the wing"}`,
      "wing/kitchen.olai": `{"id":"kitchen","ord":"a0","title":"the kitchen"}`,
    })
    const result = planned(
      wing,
      batch(
        { op: "add", parent: "kitchen", id: "sink", title: "the sink" },
        { op: "after", id: "sink", add: ["wing"] },
        { op: "title", id: "wing", title: "the west wing" },
      ),
    )
    expect(result.files.map((one) => one.file).sort(byPath))
      .toEqual(["wing/kitchen.olai", "wing.olai"])
    expect(record(fileOf(result, "wing/kitchen.olai"), "sink").after).toEqual(["wing"])
    expect(record(fileOf(result, "wing.olai"), "wing").title).toBe("the west wing")
  })

  test("a batch that touches two outlines plans both", () => {
    const two = setOf({
      "house.olai": KITCHEN,
      "shed.olai": `{"id":"shed","ord":"a0","title":"Shed"}`,
    })
    const result = planned(
      two,
      batch(
        { op: "title", id: "loose", title: "renamed" },
        { op: "add", parent: "shed", title: "a rake" },
      ),
    )
    expect(result.files.map((one) => one.file).sort()).toEqual(["house.olai", "shed.olai"])
  })
})

describe("update", () => {
  test("several fields of one node, in one plan", () => {
    const result = planned(house(), {
      op: "update",
      id: "order",
      title: "order the cabinets #kitchen",
      desc: "from the joiner",
      date: "2026-08-20",
      props: { pr: "https://x/1" },
      mark: "done",
    })
    expect(record(fileOf(result, "house.olai"), "order")).toMatchObject({
      title: "order the cabinets #kitchen",
      desc: "from the joiner",
      date: "2026-08-20",
      custom: { pr: "https://x/1" },
      done: STAMP,
      changed: STAMP,
    })
    expect(result.summary).toBe(
      "update: order the cabinets #kitchen (title, note, date, `pr`, done)",
    )
    expect(result.title).toBe("order the cabinets #kitchen")
  })

  test("`null` removes the note, the date and one property", () => {
    const rich = setOf({
      "house.olai": KITCHEN.replace(
        `{"id":"loose","ord":"a1","title":"a node with no children"}`,
        `{"id":"loose","ord":"a1","title":"a node with no children","date":"2026-08-01",` +
          `"desc":"a note","custom":{"pr":"https://x/1","agent":"claude-opus"}}`,
      ),
    })
    const result = planned(rich, {
      op: "update",
      id: "loose",
      desc: null,
      date: null,
      props: { pr: null },
    })
    const node = record(fileOf(result, "house.olai"), "loose")
    expect(node.desc).toBeUndefined()
    expect(node.date).toBeUndefined()
    expect(node.custom).toEqual({ agent: "claude-opus" })
  })

  test("`after` REPLACES — what the list leaves out comes off", () => {
    const wired = setOf({
      "house.olai": KITCHEN.replace(
        `"title":"install them","todo":true}`,
        `"title":"install them","todo":true,"after":["order","demo"]}`,
      ),
    })
    const result = planned(wired, { op: "update", id: "install", after: ["order"] })
    expect(record(fileOf(result, "house.olai"), "install").after).toEqual(["order"])

    const cleared = planned(wired, { op: "update", id: "install", after: [] })
    expect(record(fileOf(cleared, "house.olai"), "install").after).toBeUndefined()
  })

  test("`after` carries `outlines_after`'s refusals — unknown, loop, and no-op", () => {
    expect(refused(house(), { op: "update", id: "install", after: ["nowhere"] })._tag)
      .toBe("NotFoundFailure")

    const wired = setOf({
      "house.olai": KITCHEN.replace(
        `"title":"install them","todo":true}`,
        `"title":"install them","todo":true,"after":["order"]}`,
      ),
    })
    expect(refused(wired, { op: "update", id: "order", after: ["install"] }).message)
      .toContain("`order` → `install` → `order`")
    expect(refused(wired, { op: "update", id: "install", after: ["order"] }).message)
      .toBe(refused(wired, { op: "after", id: "install", add: ["order"] }).message)
    expect(refused(house(), { op: "update", id: "install", after: [] }).message)
      .toContain("at least one target to change on this node's `after`")
  })

  test("the mark is applied LAST, so an edge written beside it is already there", () => {
    const failure = refused(house(), {
      op: "update",
      id: "loose",
      mark: "doing",
      after: ["order"],
    })
    expect(failure.message).toContain("comes after 1 unfinished task")
    expect(failure.message).toContain("`order the cabinets`")
    expect(
      refused(house(), { op: "update", id: "loose", after: ["order"], mark: "doing" }).message,
    ).toBe(failure.message)
  })

  test("`mark: null` takes off whatever mark is there, and refuses when none is", () => {
    const result = planned(house(), { op: "update", id: "order", mark: null })
    expect(record(fileOf(result, "house.olai"), "order").todo).toBeUndefined()
    expect(result.summary).toBe("update: order the cabinets (un-todo)")

    expect(refused(house(), { op: "update", id: "loose", mark: null }).message)
      .toContain("carries no mark, so there is none to take off")
  })

  test("`was` is `outlines_title`'s and `outlines_desc`'s, per field, and is CHECKED", () => {
    const rich = setOf({
      "house.olai": KITCHEN.replace(
        `{"id":"loose","ord":"a1","title":"a node with no children"}`,
        `{"id":"loose","ord":"a1","title":"a node with no children","desc":"a note"}`,
      ),
    })
    const landed = planned(rich, {
      op: "update",
      id: "loose",
      title: "renamed",
      desc: "a better note",
      was: { title: "a node with no children", desc: "a note" },
    })
    expect(record(fileOf(landed, "house.olai"), "loose")).toMatchObject({
      title: "renamed",
      desc: "a better note",
    })

    const stale = refused(rich, {
      op: "update",
      id: "loose",
      title: "renamed",
      desc: "a better note",
      was: { title: "something else" },
    })
    expect(stale.message).toBe(
      refused(rich, { op: "title", id: "loose", title: "renamed", was: "something else" })
        .message,
    )
    expect(refused(rich, { op: "update", id: "loose", desc: "x", was: { desc: null } }).message)
      .toBe(refused(rich, { op: "desc", id: "loose", desc: "x", was: null }).message)

    expect(refused(rich, { op: "update", id: "loose", desc: "x", was: { title: "y" } }).message)
      .toContain("`was.title` says what this write expects")
  })

  test("a shadowed property key is refused in `outlines_prop`'s own words, undressed", () => {
    const failure = refused(house(), { op: "update", id: "order", props: { done: "x" } })
    expect(failure.message).toBe(
      refused(house(), { op: "prop", id: "order", key: "done", value: "x" }).message,
    )
    expect(failure.message).not.toContain("ops[")
  })

  test("an unknown id is answered before any field is read", () => {
    const failure = refused(house(), { op: "update", id: "nowhere", title: "x" })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("`nowhere` is not a node in the loaded set")
  })

  test("a call with no field to write is refused", () => {
    expect(refused(house(), { op: "update", id: "order" }).message)
      .toContain("give at least one field to write")
  })

  test("the whole node is stamped once, not once per field", () => {
    const result = planned(house(), {
      op: "update",
      id: "order",
      title: "renamed",
      desc: "a note",
    })
    expect(record(fileOf(result, "house.olai"), "order").changed).toBe(STAMP)
  })
})

test("the verbs `apply` will not carry are exactly the five it documents", () => {
  const opsOf = (union: unknown): ReadonlyArray<string> =>
    (union as { members: ReadonlyArray<{ fields: { op: unknown } }> }).members
      .flatMap((member) => {
        const op = member.fields.op as {
          literal?: string
          literals?: ReadonlyArray<string>
        }
        return op.literals ?? [op.literal as string]
      })

  const every = new Set(opsOf(WriteRequest))
  const batched = new Set(
    opsOf((ApplyRequest.fields.ops as unknown as { value: unknown }).value),
  )
  expect([...every].filter((op) => !batched.has(op)).sort())
    .toEqual(["apply", "create", "create-doc", "delete", "doc"])
  expect([...batched].filter((op) => !every.has(op))).toEqual([])
})
