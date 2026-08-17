/**
 * The three verbs that make one write out of several: an enriched capture,
 * `apply` and `update`.
 *
 * A file of its own rather than three more blocks in {@link ./plan.test.ts},
 * which is already three thousand lines of one op at a time — and because what
 * is under test here is a different claim. That file asks what each op DECIDES;
 * this one asks whether a run of them decides what the same ops decide one at a
 * time, which is the whole promise of batching: identical refusals, identical
 * records, one plan.
 *
 * Value in, value out, like its neighbour — the planner is pure, so the fold
 * over it is too. What only holds against a real disk (one revision, a refused
 * batch leaving the file untouched) is {@link ./ops.test.ts}'s.
 */

import {
  ApplyRequest,
  BATCH_AT_MOST,
  type BatchedRequest,
  byPath,
  derive,
  nodesOf,
  type OutlineSet,
  serializeOutline,
  WriteRequest,
  type WriteRequest as Request,
} from "@olai/format"
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

/** A batch, spelled once so the tests below read as the list of ops they are
 *  about rather than as an envelope. */
const batch = (...ops: ReadonlyArray<BatchedRequest>): Request => ({ op: "apply", ops })

/** The set ONE op leaves behind, through the same writer and parser a real
 *  write goes through — `plan.test.ts`'s helper of the same name, and here for
 *  the one thing this suite needs it for: comparing a batched refusal against
 *  the single verb run over the set the ops before it really produced. Anything
 *  less is a comparison against a set the batch was never judged on. */
const after = (set: OutlineSet, request: Request): OutlineSet => {
  const texts = Object.fromEntries(
    set.files.map((file) => [
      file,
      serializeOutline(
        nodesOf(derive(set.nodes), file).map((located) => located.node),
      ),
    ]),
  )
  for (const file of planned(set, request).files) {
    texts[file.file] = serializeOutline(file.nodes)
  }
  return setOf(texts)
}

// ── a capture that arrives wired ───────────────────────────────────────

describe("a capture carries its edges and its facts", () => {
  test("a child waits on a sibling declared LATER in the same call", () => {
    // The whole point of the second pass: `step-1` is named by `step-2` three
    // lines before the request declares it, which is how a plan is written by
    // anybody who thinks in order rather than in dependency order.
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
    // And the answer names every node it made, so the caller need not search
    // for the ids it did not choose.
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

  test("properties are written through the same writer `set_prop` reaches", () => {
    const result = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      // The empty value is the writer's own rule for absence, not a second one:
      // a key holding nothing is a key the file does not carry.
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

  test("a `props` key spelled like a field is refused in `set_prop`'s words", () => {
    const failure = refused(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      props: { done: "yesterday" },
    })
    // Word for word what `set_prop` says about the same key — the one sentence,
    // reached through one function.
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

    // …and a typo of a SIBLING this same call is minting is corrected to that
    // sibling, which the set's own ids could never have offered.
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
    // The footgun `waitsOn` costs: an agent that has read `set_after`, or that
    // is looking at the anchor one level up, writes `after` on a child. An
    // Effect struct drops a key it does not declare, so the whole dependency
    // would have vanished under a call that reported success — which is why the
    // schema declares the key purely to make it refusable.
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

    // At `add_node`'s ROOT the same word is the placement anchor and means
    // exactly what it says, so it is not refused — which is the collision this
    // whole bend exists for.
    const placed = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "lane",
      after: "demo",
    })
    expect(record(fileOf(placed, "house.olai"), "n1").title).toBe("lane")

    // A SEED's root has no siblings to be placed among, so there `after` is the
    // misspelling again and is refused like any child's.
    const seeded = refused(house(), {
      op: "create",
      file: "lane.olai",
      seed: { title: "lane", after: ["order"] } as unknown as never,
    })
    expect(seeded.message).toContain("write `waitsOn` instead")
  })

  test("the walk that finds it stops where the schema stopped", () => {
    // Below `NESTING` the schema vouched for nothing: a fourth level is an
    // array of ANYTHING, so a node down there may carry a `children` that is a
    // number, and walking into it would throw where a refusal belongs. The walk
    // is bounded to what was decoded and `emit` answers the depth instead — in
    // its own words, which is the sentence worth reading anyway.
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

  test("a loop closing through the set is refused naming it, as `set_after` would", () => {
    // `install` after `order` already; a capture that `order` waits on closes
    // the ring through two nodes the set holds and one it is minting.
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
    // `set_doing` refuses a node the set ALREADY says cannot start. There is no
    // already about a node being born, and `set_after` on a started node is
    // refused nowhere, so the pair written in one breath lands.
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

// ── apply ──────────────────────────────────────────────────────────────

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
    // Every op's work is in the ONE file the plan writes — the last plan to
    // touch a path is that path, finished.
    expect(record(nodes, "order").done).toBe(STAMP)
    expect(record(nodes, "install").custom).toEqual({ pr: "https://x/1" })
    expect(record(nodes, "loose").title).toBe("renamed")
    expect(result.summary).toContain("apply: 3 ops")
    expect(result.summary).toContain("done: order the cabinets")
    // The answer names the LAST op's subject, which is the one the run ended on.
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
    // The verb's own refusal is underneath it, and so is its KIND: a batch
    // whose second op named a missing id is a `not-found`, not a `usage`.
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("`nowhere` is not a node in the loaded set")
    expect((failure as { named?: string }).named).toBe("nowhere")
  })

  test("the done-over-open-work gate refuses exactly as `set_done` would", () => {
    const alone = refused(house(), { op: "done", id: "kitchen" })
    const batched = refused(house(), batch({ op: "done", id: "kitchen" }))
    expect(batched.message).toBe(`\`ops[0]\` (\`done\`) was refused, so nothing in ` +
      `this batch was written: ${alone.message}`)
    expect(alone.message).toContain("holds 2 unfinished tasks")
  })

  test("…and identically when the batch is what MADE the work unfinished", () => {
    // The test above pins the message against a set the batch did not change,
    // which any implementation that forgot to fold would also pass. This one
    // cannot be passed that way: `loose` holds nothing at all until op 0 files
    // a task under it, and op 1's refusal has to NAME that task — so the gate
    // is demonstrably reading the set op 0 left rather than the set the call
    // arrived at.
    const filed = { op: "add", parent: "loose", id: "chase", title: "chase it", mark: "todo" }
    const batched = refused(house(), batch(filed as BatchedRequest, { op: "done", id: "loose" }))
    expect(batched.message).toContain("`chase it` (`chase`, todo)")

    // And it is the single verb's sentence, word for word — asserted against
    // `set_done` run alone over the set that capture really leaves, which is
    // the only comparison that says "identical" about a moving target.
    const alone = refused(after(house(), filed as Request), { op: "done", id: "loose" })
    expect(batched.message).toBe(
      `\`ops[1]\` (\`done\`) was refused, so nothing in this batch was written: ` +
        alone.message,
    )
  })

  test("a batch that finishes the branch first may then mark it done", () => {
    // The same gate, walked through legally: door one looks at the set as the
    // ops before it left it, so the two children going done is what lets the
    // parent go done in the same call.
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

  test("`set_doing` after `set_after` in one batch meets the same gate", () => {
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
    // Door two, twice: two tasks arriving under a branch marked done.
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
    // The first re-opens it; the second finds nothing left to re-open, so the
    // sentence is said once rather than twice.
    expect(result.nudge).toContain("`Kitchen remodel` was marked done")
    expect(result.nudge?.match(/marked done over work/g)).toHaveLength(1)
    expect(record(fileOf(result, "house.olai"), "kitchen").done).toBeUndefined()
  })

  test("an op after an archive is planned against the file the archive made", () => {
    // `archive` mints an `Archive.olai` that the set has never held, so the
    // reading the NEXT op is judged against carries a file the derivation was
    // not built from. That is the one case the fold's patched view has to get
    // right — and the proof is that the second op can name the node that has
    // just moved into it.
    const result = planned(
      house(),
      batch(
        { op: "archive", id: "order" },
        { op: "title", id: "order", title: "order the walnut cabinets" },
      ),
    )
    expect(result.files.map((one) => one.file).sort()).toEqual([
      "Archive.olai",
      "house.olai",
    ])
    expect(record(fileOf(result, "Archive.olai"), "order").title)
      .toBe("order the walnut cabinets")
    expect(fileOf(result, "house.olai").some((one) => one.id === "order")).toBe(false)
  })

  test("the fold and the patcher agree about a file beside a directory", () => {
    // WHERE THE TWO HALVES OF format/ MEET. The fold rebuilds a real set per op
    // (`assemble`, which orders by `byPath`) and asks the format to patch the
    // view onto it (`reading`, whose `patch` orders the same way) — and slice 4
    // of `model-indices` is what made those one answer instead of two, because
    // `.` sorts before `/` and a bare code-point compare puts `wing.olai` ahead
    // of the directory it names while a walk descends first.
    //
    // A batch across exactly that pair is the case where a disagreement would
    // show: `viewOf`'s identity check would fail, the fold would silently fall
    // back to a full `derive` — still correct, which is why nothing else here
    // would catch it — and op 1 would be planned against a set in an order no
    // load produces. Both ops land, in the right files, in the right order.
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
    // Op 1 resolved an id declared in the OTHER file, against the view the
    // patcher produced — which is the half that needs the two orders to agree.
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

// ── update ─────────────────────────────────────────────────────────────

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
    // The subject names the node as this call LEFT it, which is the new title.
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
    // MERGED, not replaced: the key nobody named is still there.
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

  test("`after` carries `set_after`'s refusals — unknown, loop, and no-op", () => {
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
    // A list identical to what is there changes nothing, and is turned away
    // rather than written — `set_after`'s own no-op refusal, word for word.
    expect(refused(wired, { op: "update", id: "install", after: ["order"] }).message)
      .toBe(refused(wired, { op: "after", id: "install", add: ["order"] }).message)
    // …and the emptiest no-op of all, `[]` over a node that has none, is the
    // same verb saying there is nothing here to change.
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
    // And nothing about the field ORDER in the request changes that: the fold
    // is fixed, not read off the JSON.
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

  test("`was` is `set_title`'s and `set_desc`'s, per field, and is CHECKED", () => {
    const rich = setOf({
      "house.olai": KITCHEN.replace(
        `{"id":"loose","ord":"a1","title":"a node with no children"}`,
        `{"id":"loose","ord":"a1","title":"a node with no children","desc":"a note"}`,
      ),
    })
    // The condition holds, so the write lands — both fields, one plan.
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

    // It does not, so NOTHING lands — and the sentence is the single verb's,
    // word for word, which is the guarantee this field exists to keep.
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
    // `null` is a real condition on a note — "expects none" — so a node that
    // HAS one is refused by it.
    expect(refused(rich, { op: "update", id: "loose", desc: "x", was: { desc: null } }).message)
      .toBe(refused(rich, { op: "desc", id: "loose", desc: "x", was: null }).message)

    // A condition on a field this call does not write is a mis-typed call, not
    // a silent no-op.
    expect(refused(rich, { op: "update", id: "loose", desc: "x", was: { title: "y" } }).message)
      .toContain("`was.title` says what this write expects")
  })

  test("a shadowed property key is refused in `set_prop`'s own words, undressed", () => {
    const failure = refused(house(), { op: "update", id: "order", props: { done: "x" } })
    expect(failure.message).toBe(
      refused(house(), { op: "prop", id: "order", key: "done", value: "x" }).message,
    )
    // No index: the caller wrote fields, not a list, so there is nothing to
    // point at.
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
    // One `changed`, because the fold writes one record — and it is the same
    // instant the planner's context minted for the whole call.
    expect(record(fileOf(result, "house.olai"), "order").changed).toBe(STAMP)
  })
})

// ── the two membership lists ───────────────────────────────────────────

/**
 * `apply` carries the write verbs, and NOT carrying one has to be a decision.
 *
 * The arms of `ApplyRequest` are the request schemas themselves, so nothing can
 * drift about what an op LOOKS like. What is still two hand-written lists is
 * which verbs are in each one — `BATCHED` and `WriteRequest` — and a node verb
 * added to the second and forgotten in the first is silently un-batchable, with
 * nothing anywhere to say so.
 *
 * So the DIFFERENCE is what is pinned, rather than either list: exactly the
 * three writes whose subject is a FILE, and `apply` itself. A fifth name on
 * either side fails here, which is the moment to decide rather than the moment
 * to notice.
 */
test("the verbs `apply` will not carry are exactly the four it documents", () => {
  // The `op` tag of every arm of a union, read off the schemas rather than
  // listed here — a list would be a third thing to keep in step with the two
  // this is about. `Schema.Literal` carries `literal`; `Schema.Literals` (the
  // three marks, which share one request) carries `literals`.
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
    .toEqual(["apply", "create", "create-doc", "doc"])
  // …and nothing is batchable that is not a write at all.
  expect([...batched].filter((op) => !every.has(op))).toEqual([])
})
