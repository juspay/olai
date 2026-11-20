import { DocumentPath } from "./address.ts"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { rowsOf } from "./derive.ts"
import { bodiedDocument, type Document } from "./document.ts"
import { blamedOn, implicatedBy, isCrossFile, type OutlineError } from "./errors.ts"
import { blamed, type Verdict, verdictOf } from "./verdict.ts"
import {
  decodedOf,
  findingsIn,
  outlineOf,
  recordsOf,
  setOf,
  validatedOf,
} from "./fixtures.testlib.ts"
import {
  assemble,
  brokenBy,
  brokenIn,
  documentAt,
  type OutlineSet,
  outlinePaths,
  outlinesIn,
  withDocuments,
} from "./set.ts"
import type { ContributedKind, KindVocabulary } from "./typing.ts"
import { following, type Previous, type Reading, reading, validate } from "./validate.ts"
const errorsOf = (
  files: Record<string, string>,
  documents: ReadonlyArray<string> = [],
  broken: Record<string, string> = {},
): ReadonlyArray<OutlineError> => findingsIn(validatedOf(files, documents, broken))

const degradedBy = (
  files: Record<string, string>,
  documents: ReadonlyArray<string> = [],
  broken: Record<string, string> = {},
): { readonly set: OutlineSet; readonly dark: ReadonlyArray<string> } => {
  const set = validatedOf(files, documents, broken)
  return { set, dark: set.broken.map((entry) => entry.file) }
}

const expectValid = (
  files: Record<string, string>,
  documents: ReadonlyArray<string> = [],
  broken: Record<string, string> = {},
): OutlineSet => {
  const set = setOf(files, documents, broken)
  const result = validate(TEST_CLAIMS, set)
  if (Result.isFailure(result)) {
    throw new Error(
      `expected a valid set: ${
        result.failure.findings.map((e) => `${e.file}:${e.line} ${e.message}`).join("; ")
      }`,
    )
  }
  expect(result.success.set).toBe(set)
  const records = recordsOf(set)
  expect(result.success.derived.nodes.length).toBe(records.length)
  expect(result.success.derived.nodes.every((at, index) => at === records[index])).toBe(
    true,
  )
  expect(outlinePaths(result.success.set).length).toBe(
    Object.keys(files).length + Object.keys(broken).length,
  )
  return result.success.set
}

const only = (errors: ReadonlyArray<OutlineError>): OutlineError => {
  const [error] = errors
  if (error === undefined || errors.length !== 1) {
    throw new Error(`expected exactly one error, got ${errors.length}`)
  }
  return error
}

const codes = (errors: ReadonlyArray<OutlineError>): ReadonlyArray<string> =>
  errors.map((error) => error.code)

test("a set using every relation loads clean", () => {
  expectValid(
    {
      "home.olai": `{"id":"kitchen","ord":"a","title":"kitchen #reno"}\n` +
        `{"id":"demo","parent":"kitchen","ord":"a","title":"demolition","done":"2026-08-01"}\n` +
        `{"id":"order","parent":"kitchen","ord":"b","title":"order cabinets","after":["demo"],"see":["budget"],"desc":"[document](notes/cabinets.md)"}\n`,
      "work.olai": `{"id":"budget","ord":"a","title":"the budget","blocks":["order"]}\n` +
        `{"id":"m","ord":"b","mirror":"order"}\n`,
    },
    ["notes/cabinets.md"],
  )
})

test("a view that is not about this set is not the view the rules run over", () => {
  const before = setOf({
    "a.olai": `{"id":"x","ord":"a","title":"one"}`,
    "b.olai": `{"id":"y","ord":"a","title":"two"}`,
  })
  const first = validate(TEST_CLAIMS, before)
  if (Result.isFailure(first)) throw new Error("expected the first set to be valid")

  const after = setOf({
    "a.olai": `{"id":"x","ord":"a","title":"edited"}`,
    "b.olai": `{"id":"y","ord":"a","title":"two"}`,
  })
  const answer = validate(TEST_CLAIMS, after, {
    read: first.success,
    delta: { upserts: [], removes: [] },
  })

  if (Result.isFailure(answer)) {
    throw new Error(
      `expected the set in hand to be judged: ${
        answer.failure.findings.map((e) => e.code).join(", ")
      }`,
    )
  }
  const records = recordsOf(after)
  expect(answer.success.derived.nodes.every((at, index) => at === records[index])).toBe(
    true,
  )
  expect(answer.success.derived.byId.get("x")).toBe(records[0])
})

const probed = (
  held: Map<string, Result.Result<Document, Verdict>>,
  read: Reading,
  file: string,
  text: string,
): { readonly set: OutlineSet; readonly previous: Previous } => {
  held.set(file, Result.succeed<Document>(outlineOf(text, file)))
  const set = assemble(TEST_CLAIMS, held)
  const nodes = recordsOf(set).filter((at) => at.file === file)
  return { set, previous: { read, delta: { upserts: [[file, { nodes }]], removes: [] } } }
}

const judged = (set: OutlineSet, previous?: Previous): Reading => {
  const answer = validate(TEST_CLAIMS, set, previous)
  if (Result.isFailure(answer)) {
    throw new Error(
      `expected a valid set: ${answer.failure.findings.map((e) => e.code).join(", ")}`,
    )
  }
  return answer.success
}

test("a delta that describes the set is taken, and the view is a patched one", () => {
  const held = decodedOf({
    "a.olai": `{"id":"x","ord":"a","title":"one"}`,
    "b.olai": `{"id":"y","ord":"a","title":"two"}`,
  })
  const first = judged(assemble(TEST_CLAIMS, held))
  const { set, previous } = probed(held, first, "a.olai", `{"id":"x","ord":"a","title":"edited"}`)
  const answer = judged(set, previous)

  expect(answer.derived.byId instanceof Map).toBe(false)
  expect(answer.derived.byId.get("x")?.node).toMatchObject({ title: "edited" })
  const records = recordsOf(set)
  expect(answer.derived.nodes.every((at, index) => at === records[index])).toBe(true)
  expect(answer.derived.nodes).toBe(answer.derived.nodes)
})

test("an outline holding nothing is not a disagreement about the set", () => {
  const held = decodedOf({
    "a.olai": `{"id":"x","ord":"a","title":"one"}`,
    "empty.olai": ``,
    "z.olai": `{"id":"y","ord":"a","title":"two"}`,
  })
  const first = judged(assemble(TEST_CLAIMS, held))
  const { set, previous } = probed(held, first, "a.olai", `{"id":"x","ord":"a","title":"edited"}`)
  const answer = judged(set, previous)

  expect(answer.derived.byId instanceof Map).toBe(false)
  expect(answer.derived.byId.get("x")?.node).toMatchObject({ title: "edited" })
  expect([...answer.derived.byFile.keys()]).toEqual(["a.olai", "z.olai"])
})

test("a delta that leaves the view holding a file the set lost is thrown away", () => {
  const held = decodedOf({
    "a.olai": `{"id":"x","ord":"a","title":"one"}`,
    "b.olai": `{"id":"y","ord":"a","title":"two"}`,
  })
  const first = judged(assemble(TEST_CLAIMS, held))
  held.delete("b.olai")
  const set = assemble(TEST_CLAIMS, held)
  const answer = judged(set, { read: first, delta: { upserts: [], removes: [] } })

  expect([...answer.derived.byFile.keys()]).toEqual(["a.olai"])
  expect(answer.derived.byId.has("y")).toBe(false)
  const records = recordsOf(set)
  expect(answer.derived.nodes.every((at, index) => at === records[index])).toBe(true)
})

test("a file with no nodes is a member of the set, not a problem with it", () => {
  expectValid({
    "empty.olai": ``,
    "a.olai": `{"id":"a","ord":"a","title":"a"}\n`,
  })
})

test("a duplicate id is reported on the second record, pointing at the first", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"x","ord":"a","title":"one"}`,
      "b.olai": `{"id":"x","ord":"a","title":"two"}`,
    }),
  )
  expect(error.code).toBe("duplicate-id")
  expect([error.file, error.line]).toEqual(["b.olai", 1])
  expect(error.related).toEqual([
    { file: "a.olai", line: 1, note: "first declared here" },
  ])
  expect(isCrossFile(error)).toBe(true)
})

test("an unknown parent suggests the near id", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"kitchen","ord":"a","title":"k"}\n` +
        `{"id":"sink","parent":"kitchn","ord":"b","title":"s"}`,
    }),
  )
  expect(error.code).toBe("unknown-parent")
  expect(error.line).toBe(2)
  expect(error.message).toContain("did you mean `kitchen`?")
})

test("an unknown parent nothing resembles gets no did-you-mean", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"kitchen","ord":"a","title":"k"}\n` +
        `{"id":"sink","parent":"zzz","ord":"b","title":"s"}`,
    }),
  )
  expect(error.code).toBe("unknown-parent")
  expect(error.message).not.toContain("did you mean")
})

test("a parent in another file is a foreign-parent, not an unknown one", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"kitchen","ord":"a","title":"k"}`,
      "b.olai": `{"id":"sink","parent":"kitchen","ord":"a","title":"s"}`,
    }),
  )
  expect(error.code).toBe("foreign-parent")
  expect([error.file, error.line]).toEqual(["b.olai", 1])
  expect(error.message).toContain("`mirror`")
  expect(error.related).toEqual([
    { file: "a.olai", line: 1, note: "the parent lives here", broken: false },
  ])
  expect(implicatedBy(error)).toEqual(["b.olai", "a.olai"])
  expect(isCrossFile(error)).toBe(false)
  expect(blamed([error]).map((one) => one.file)).toEqual(["b.olai"])
})

test("a child of a mirror is refused", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"k","ord":"a","title":"k"}\n` +
        `{"id":"m","ord":"b","mirror":"k"}\n` +
        `{"id":"c","parent":"m","ord":"c","title":"c"}`,
    }),
  )
  expect(error.code).toBe("parent-not-a-node")
  expect(error.line).toBe(3)
  expect(error.related?.[0]).toEqual({ file: "a.olai", line: 2, note: "the mirror is here" })
})

test("a parent cycle is one error naming the whole loop", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"a","parent":"b","ord":"a","title":"a"}\n` +
        `{"id":"b","parent":"a","ord":"b","title":"b"}`,
    }),
  )
  expect(error.code).toBe("parent-cycle")
  expect(error.line).toBe(1)
  expect(error.message).toContain("`a` → `b` → `a`")
  expect(error.related).toEqual([{ file: "a.olai", line: 2, note: "also in the loop" }])
})

test("a dangling target is reported for mirror, after, blocks and see alike", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","ord":"a","title":"a","after":["no1"],"blocks":["no2"],"see":["no3"]}\n` +
      `{"id":"m","ord":"b","mirror":"no4"}`,
  })
  expect(codes(errors)).toEqual([
    "unknown-target",
    "unknown-target",
    "unknown-target",
    "unknown-target",
  ])
  expect(errors.map((error) => error.message.replace(/^`(\w+)`.*$/, "$1"))).toEqual([
    "after",
    "blocks",
    "see",
    "mirror",
  ])
})

const sites = (
  errors: ReadonlyArray<OutlineError>,
): ReadonlyArray<readonly [number, string]> =>
  errors.map((error) => [error.line, error.message.replace(/^`(\w+)`.*$/, "$1")] as const)

test("two unknown targets on one record come out in the order the corpus first names them", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","ord":"a","title":"a","see":["zz"]}\n` +
      `{"id":"b","ord":"b","title":"b","after":["aa"],"see":["zz"]}`,
  })
  expect(sites(errors)).toEqual([[1, "see"], [2, "see"], [2, "after"]])
})

test("one unknown id named with two fields is one finding per field", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","ord":"a","title":"a","after":["gone"],"see":["gone"]}`,
  })
  expect(sites(errors)).toEqual([[1, "after"], [1, "see"]])
})

test("the same unknown id named twice in one field is one finding, not two", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","ord":"a","title":"a","after":["gone","gone"]}`,
  })
  expect(sites(errors)).toEqual([[1, "after"]])
})

test("an after cycle is refused", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"a","ord":"a","title":"a","after":["b"]}\n` +
        `{"id":"b","ord":"b","title":"b","after":["a"]}`,
    }),
  )
  expect(error.code).toBe("after-cycle")
  expect(error.message).toContain("`a` → `b` → `a`")
})

test("a cycle written only in blocks is the same after-cycle", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"a","ord":"a","title":"a","blocks":["b"]}\n` +
        `{"id":"b","ord":"b","title":"b","blocks":["a"]}`,
    }),
  )
  expect(error.code).toBe("after-cycle")
  expect(error.message).toContain("`a` → `b` → `a`")
})

test("an after cycle closing through a mirror is refused", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"x","ord":"a","title":"x","after":["m"]}\n` +
        `{"id":"y","ord":"b","title":"y","after":["x"]}`,
      "b.olai": `{"id":"m","ord":"a","mirror":"y"}`,
    }),
  )
  expect(error.code).toBe("after-cycle")
  expect(error.message).toContain("`x` → `y` → `x`")
})

test("an after cycle through the archive is still refused", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"live","ord":"a","title":"live","doing":true,"after":["old"]}`,
      "_olai/Trash.olai": `{"id":"old","ord":"a","title":"old","done":true,"after":["live"]}`,
    }),
  )
  expect(error.code).toBe("after-cycle")
  expect(error.message).toContain("`old` → `live` → `old`")
})

test("mirrors that show each other are a mirror-cycle", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
    }),
  )
  expect(error.code).toBe("mirror-cycle")
  expect(error.message).toContain("`m1` → `m2` → `m1`")
  expect(error.related).toEqual([{ file: "a.olai", line: 2, note: "also in the loop" }])
})

test("a mirror placed inside the subtree it shows is a mirror-cycle", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"a"}`,
  })
  expect(codes(errors)).toEqual(["mirror-cycle"])
})

test("a mirror is still a cycle when the subtree it shows lives elsewhere", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"b"}`,
    "b.olai": `{"id":"b","ord":"a","title":"b"}\n{"id":"n","parent":"b","ord":"b","mirror":"a"}`,
  })
  expect(codes(errors)).toContain("mirror-cycle")
})

test("a pure parent cycle is not also reported as a mirror-cycle", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","parent":"b","ord":"a","title":"a"}\n` +
      `{"id":"b","parent":"a","ord":"b","title":"b"}`,
  })
  expect(codes(errors)).toEqual(["parent-cycle"])
})


test("a relative note link to a missing file never invalidates its outline", () => {
  expectValid({ "sub/plan.olai": `{"id":"a","ord":"a","title":"a","desc":"[note](../missing.md)"}` })
})

test("a mark on a node with children is a set that loads", () => {
  expectValid({
    "a.olai": `{"id":"p","ord":"a","title":"p","done":"2026-08-11"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","doing":true}\n` +
      `{"id":"q","ord":"b","title":"q","done":true}\n` +
      `{"id":"q1","parent":"q","ord":"a","title":"q1","done":true}\n` +
      `{"id":"notes","ord":"c","title":"read this book","todo":"2026-08-11"}\n` +
      `{"id":"n1","parent":"notes","ord":"a","title":"chapter three is the good one"}`,
  })
})

test("a merge that marks a leaf and gives it a child still loads", () => {
  expectValid({
    "a.olai": `{"id":"leaf","ord":"a","title":"leaf","done":"2026-08-10"}\n` +
      `{"id":"arrived","parent":"leaf","ord":"a","title":"arrived from the other branch","todo":true}`,
  })
})

test("errors come back sorted by file, then line", () => {
  const errors = errorsOf({
    "b.olai": `{"id":"b1","parent":"nope","ord":"a","title":"b"}`,
    "a.olai": `{"id":"a1","ord":"a","title":"a","see":["nope"]}\n` +
      `{"id":"a2","parent":"nope","ord":"b","title":"a"}`,
  })
  expect(errors.map((error) => `${error.file}:${error.line}`)).toEqual([
    "a.olai:1",
    "a.olai:2",
    "b.olai:1",
  ])
})

test("a file that did not parse leaves the rest of the set valid", () => {
  const set = expectValid(
    { "garden.olai": `{"id":"garden","ord":"a","title":"garden"}` },
    [],
    { "house.olai": `{"id":"kitchen","ord":"a",title:"kitchen"}` },
  )
  expect(set.broken.map((file) => file.file)).toEqual(["house.olai"])
  expect(set.broken[0]?.errors.map((error) => error.code)).toEqual(["not-json"])
})

test("a target that the unreadable file might declare is not reported as unknown", () => {
  const errors = errorsOf(
    { "garden.olai": `{"id":"garden","ord":"a","title":"g","see":["elsewhere"]}` },
    [],
    { "house.olai": `{"id":"kitchen","ord":"a",title:"kitchen"}` },
  )
  expect(codes(errors)).toEqual(["not-json"])
  expect(errors[0]?.file).toBe("house.olai")
})

test("an error the unreadable file cannot explain is reported with it", () => {
  const errors = errorsOf(
    {
      "a.olai": `{"id":"x","ord":"a","title":"one"}`,
      "b.olai": `{"id":"x","ord":"a","title":"two"}`,
    },
    [],
    { "c.olai": `{"id":"y","ord":"a",title:"three"}` },
  )
  expect(codes(errors)).toEqual(["duplicate-id", "not-json"])
})

test("an unknown parent is reported even when a file did not parse", () => {
  const errors = errorsOf(
    { "a.olai": `{"id":"sink","parent":"nowhere","ord":"a","title":"s"}` },
    [],
    { "b.olai": `{"id":"y","ord":"a",title:"y"}` },
  )
  expect(codes(errors)).toEqual(["unknown-parent", "not-json"])
})

const DECLARING = {
  "_olai/Properties.olai": [
    `{"id":"prop-merge","ord":"a0","title":"merge","custom":{"type":"ref"}}`,
    `{"id":"auto","parent":"prop-merge","ord":"a0","title":"automatic"}`,
    `{"id":"human","parent":"prop-merge","ord":"a1","title":"the human merges"}`,
    `{"id":"prop-dispatched","ord":"a1","title":"dispatched","custom":{"type":"date"}}`,
    `{"id":"prop-pr","ord":"a2","title":"pr","custom":{"type":"int"}}`,
  ].join("\n"),
}

test("a declared vault whose values fit loads", () => {
  expectValid({
    ...DECLARING,
    "lanes.olai":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"merge":"auto","dispatched":"2026-08-25T10:06:00-04:00","pr":"193"}}`,
  })
})

test("a hand edit that lands a bad value is a broken file naming the key", () => {
  const errors = errorsOf({
    ...DECLARING,
    "lanes.olai":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"merge":"AUTO: grok review folded + CI green"}}`,
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.file).toBe("lanes.olai")
  expect(errors[0]?.line).toBe(1)
  expect(errors[0]?.message).toContain("`merge` is `auto` | `human`")
})

test("a bad value's finding names the declaration that judged it", () => {
  const errors = errorsOf({
    ...DECLARING,
    "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"not-a-number"}}`,
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.file).toBe("lanes.olai")
  expect(errors[0]?.related).toEqual([
    { file: "_olai/Properties.olai", line: 5, note: "declared here", broken: false },
  ])
})

test("one finding per KEY, in the order the record's own bytes hold them", () => {
  const errors = errorsOf({
    ...DECLARING,
    "lanes.olai":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"#193","dispatched":"whenever"}}`,
  })
  expect(codes(errors)).toEqual(["bad-prop", "bad-prop"])
  expect(errors[0]?.message).toContain("`pr`")
  expect(errors[1]?.message).toContain("`dispatched`")
})

test("an undeclared key beside declared ones is left entirely alone", () => {
  expectValid({
    ...DECLARING,
    "lanes.olai":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"terminal":"a-uuid-with (a remark)","merge":"human"}}`,
  })
})

test("a ref value whose target is deleted is flagged like a dangling edge", () => {
  const files = {
    "_olai/Properties.olai":
      `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}`,
    "agents.olai": [
      `{"id":"roster","ord":"a0","title":"the agents"}`,
      `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
      `{"id":"grok","parent":"roster","ord":"a1","title":"Grok"}`,
    ].join("\n"),
    "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"grok"}}`,
  }
  expectValid(files)
  const errors = errorsOf({
    ...files,
    "agents.olai": files["agents.olai"].split("\n").slice(0, 2).join("\n"),
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.file).toBe("lanes.olai")
  expect(errors[0]?.message).toContain("names a node under `roster`")
})

test("a doc value resolves relative to the outline that names it", () => {
  const declaring = {
    "_olai/Properties.olai": `{"id":"prop-brief","ord":"a0","title":"brief","custom":{"type":"doc"}}`,
  }
  expectValid({
    ...declaring,
    "orchestrator/lanes.olai":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"brief":"../briefs/pdb.md"}}`,
  }, ["briefs/pdb.md"])
  const errors = errorsOf({
    ...declaring,
    "orchestrator/lanes.olai":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"brief":"briefs/pdb.md"}}`,
  }, ["briefs/pdb.md"])
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.message).toContain("orchestrator/briefs/pdb.md")
})

test("a declaration the built-in table does not know is a broken declarations file", () => {
  const errors = errorsOf({
    "_olai/Properties.olai": `{"id":"p","ord":"a0","title":"stage","custom":{"type":"colour"}}`,
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.file).toBe("_olai/Properties.olai")
  expect(errors[0]?.message).toContain("which is not a property type — write `text` (anything)")
  expect(errors[0]?.message).toContain("`ref` (a child's id; `under` names the parent)")
  expect(errors[0]?.message).toContain("`int` (a digit run)")
})

test("a declaration with no type at all says so", () => {
  const errors = errorsOf({
    "_olai/Properties.olai": `{"id":"p","ord":"a0","title":"stage"}`,
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.message).toContain("does not say its `type`")
  expect(errors[0]?.message).toContain("`text` (anything)")
  expect(errors[0]?.message).toContain("`ref` (a child's id; `under` names the parent)")
})

test("`under` on something that is not a ref, and `under` naming nothing", () => {
  expect(
    errorsOf({
      "_olai/Properties.olai":
        `{"id":"p","ord":"a0","title":"stage","custom":{"type":"date","under":"roster"}}`,
      "a.olai": `{"id":"roster","ord":"a0","title":"the roster"}`,
    })[0]?.message,
  ).toContain("takes its values from nowhere in particular")
  expect(
    errorsOf({
      "_olai/Properties.olai":
        `{"id":"p","ord":"a0","title":"stage","custom":{"type":"ref","under":"rostr"}}`,
      "a.olai": `{"id":"roster","ord":"a0","title":"the roster"}`,
    })[0]?.message,
  ).toContain("did you mean `roster`?")
})

test("a key declared twice is reported on the SECOND claim, not the first", () => {
  const errors = errorsOf({
    "_olai/Properties.olai": [
      `{"id":"p1","ord":"a0","title":"merge","custom":{"type":"int"}}`,
      `{"id":"p2","ord":"a1","title":"merge","custom":{"type":"date"}}`,
    ].join("\n"),
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.line).toBe(2)
  expect(errors[0]?.message).toContain("already declared by an earlier node")
})

test("a variant may not pretend to be a declaration", () => {
  const errors = errorsOf({
    "_olai/Properties.olai": [
      `{"id":"prop-merge","ord":"a0","title":"merge","custom":{"type":"ref"}}`,
      `{"id":"auto","parent":"prop-merge","ord":"a0","title":"auto","custom":{"type":"int"}}`,
    ].join("\n"),
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.line).toBe(2)
  expect(errors[0]?.message).toContain("only a TOP-LEVEL node of this file declares one")
})

test("a key spelled like a field, and the two words the bootstrap reserves", () => {
  expect(
    errorsOf({
      "_olai/Properties.olai": `{"id":"p","ord":"a0","title":"done","custom":{"type":"text"}}`,
    })[0]?.message,
  ).toContain("`outlines_done` writes it")
  expect(
    errorsOf({
      "_olai/Properties.olai": `{"id":"p","ord":"a0","title":"type","custom":{"type":"text"}}`,
    })[0]?.message,
  ).toContain("says about ITSELF")
})

test("the declarations file is found by stem under _olai", () => {
  const errors = errorsOf({
    "_olai/Properties.olai": `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
    "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"#193"}}`,
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.file).toBe("lanes.olai")
})


const isAbout = (read: Reading): boolean => {
  const outlines = outlinesIn(read.set).filter((outline) => outline.nodes.length > 0)
  if (read.derived.byFile.size !== outlines.length) return false
  let which = 0
  for (const [file, records] of read.derived.byFile) {
    const outline = outlines[which++]
    if (outline === undefined || outline.path !== file) return false
    if (outline.nodes.length !== records.length) return false
    for (let at = 0; at < records.length; at++) {
      if (records[at] !== outline.nodes[at]) return false
    }
  }
  return true
}

const carriedAcross = (before: Reading, after: Reading, untouched: string): boolean =>
  before.derived.byFile.get(untouched) !== undefined &&
  after.derived.byFile.get(untouched) === before.derived.byFile.get(untouched)

const vault = (): Reading =>
  reading(TEST_CLAIMS,
    setOf(
      {
        "a.olai": `{"id":"x","ord":"a","title":"one"}`,
        "b.olai": `{"id":"y","ord":"a","title":"two"}\n{"id":"z","ord":"b","title":"three"}`,
        "empty.olai": ``,
      },
      ["notes/one.md"],
    ),
  )

test("a file rewritten leaves a view of the set it leaves, patched", () => {
  const before = vault()
  const after = following(before, [outlineOf(`{"id":"x","ord":"a","title":"edited"}`, "a.olai")])

  expect(carriedAcross(before, after, "b.olai")).toBe(true)
  expect(isAbout(after)).toBe(true)
  expect(after.derived.byId.get("x")?.node).toMatchObject({ title: "edited" })
})

test("a file that ARRIVES mid-write reaches the view, and the view is about the set", () => {
  const before = vault()
  const after = following(before, [
    outlineOf(`{"id":"w","ord":"a","title":"minted"}`, "_olai/Trash.olai"),
  ])

  expect(carriedAcross(before, after, "a.olai")).toBe(true)
  expect(isAbout(after)).toBe(true)
  expect(after.derived.byId.get("w")?.file).toBe("_olai/Trash.olai")
  expect([...after.derived.byFile.keys()]).toEqual(["_olai/Trash.olai", "a.olai", "b.olai"])
})

test("a file EMPTIED leaves no key, which is how a file with no records is spelt", () => {
  const before = vault()
  const after = following(before, [outlineOf(``, "b.olai")])

  expect(carriedAcross(before, after, "a.olai")).toBe(true)
  expect(isAbout(after)).toBe(true)
  expect(after.derived.byFile.has("b.olai")).toBe(false)
  expect(after.derived.byId.has("y")).toBe(false)
})

test("a `.md` written beside an outline moves the set and not the view's records", () => {
  const before = vault()
  const after = following(before, [
    bodiedDocument(TEST_CLAIMS, "notes/one.md", "# rewritten\n\n[the node](#x)\n"),
    outlineOf(`{"id":"x","ord":"a","title":"edited"}`, "a.olai"),
  ])

  expect(isAbout(after)).toBe(true)
  expect(documentAt(after.set, "notes/one.md")).toMatchObject({
    body: "# rewritten\n\n[the node](#x)\n",
  })
  expect(after.pointing.get("#x")?.map((source) => String(source.face.path))).toEqual(["notes/one.md"])
})

test("writing nothing leaves the reading that stood, identity and all", () => {
  const before = vault()
  const after = following(before, [])

  expect(after.set).toBe(before.set)
  expect(after.derived).toBe(before.derived)
  expect(after.pointing).toBe(before.pointing)
})

test("a written file the view would file differently is not patched onto", () => {
  const before = vault()
  const written = outlineOf(
    `{"id":"y","ord":"a","title":"two"}\n{"id":"z","ord":"b","title":"three"}`,
    "b.olai",
  )
  const backwards: Document = { ...written, nodes: [...written.nodes].reverse() }
  const after = following(before, [backwards])
  const alsoAfter = reading(TEST_CLAIMS, withDocuments(before.set, [backwards]), {
    read: before,
    delta: { upserts: [["b.olai", { nodes: backwards.nodes }]], removes: [] },
  })

  expect(carriedAcross(before, after, "a.olai")).toBe(false)
  expect(carriedAcross(before, alsoAfter, "a.olai")).toBe(false)
  expect([...after.derived.byFile.keys()]).toEqual([...alsoAfter.derived.byFile.keys()])
  expect(after.derived.nodes).toEqual(alsoAfter.derived.nodes)
})

test("one path written in two KINDS leaves a view of the set, not of the outline", () => {
  const before = vault()
  const mixed: ReadonlyArray<Document> = [
    outlineOf(`{"id":"q","ord":"a","title":"an outline at this path"}`, "c.olai"),
    { ...bodiedDocument(TEST_CLAIMS, "c.md", "a body where the records would have been"), path: DocumentPath.make("c.olai") },
  ]

  const after = following(before, mixed)
  expect(isAbout(after)).toBe(true)
  expect(after.derived.byFile.has("c.olai")).toBe(false)
  expect(after.derived.byId.has("q")).toBe(false)
  expect(documentAt(after.set, "c.olai")?.holds).toBe("text")
  const then = following(after, [outlineOf(`{"id":"x","ord":"a","title":"later"}`, "a.olai")])
  expect(isAbout(then)).toBe(true)
  expect(then.derived.byId.has("q")).toBe(false)
})

test("...and where that path HELD records, it is a write the door declines", () => {
  const before = vault()
  const asOutline = outlineOf(`{"id":"q","ord":"a","title":"an outline at this path"}`, "b.olai")
  const mixed: ReadonlyArray<Document> = [
    asOutline,
    { ...bodiedDocument(TEST_CLAIMS, "b.md", "a body where the records were"), path: DocumentPath.make("b.olai") },
  ]

  const after = following(before, mixed)
  expect(isAbout(after)).toBe(true)
  expect(carriedAcross(before, after, "a.olai")).toBe(false)
  expect(after.derived.byFile.has("b.olai")).toBe(false)
  expect(after.derived.byId.has("y")).toBe(false)
  expect(after.derived.byId.has("q")).toBe(false)

  const alsoAfter = reading(TEST_CLAIMS, withDocuments(before.set, mixed), {
    read: before,
    delta: { upserts: [["b.olai", { nodes: asOutline.nodes }]], removes: [] },
  })
  expect(isAbout(alsoAfter)).toBe(true)
  expect(alsoAfter.derived.byFile.has("b.olai")).toBe(false)
  expect(alsoAfter.derived.byId.has("q")).toBe(false)
})

test("a broken file is withheld and its neighbours are untouched", () => {
  const { set, dark } = degradedBy({
    "attic.olai": `{"id":"attic","ord":"a","title":"the attic"}\n` +
      `{"id":"lamps","ord":"b","title":"the lamps","see":["nobody-declares-this"]}`,
    "cellar.olai": `{"id":"cellar","ord":"a","title":"the cellar"}\n` +
      `{"id":"crates","parent":"cellar","ord":"b","title":"the crates"}`,
  })

  expect(dark).toEqual(["attic.olai"])
  expect(brokenBy(set).get("attic.olai")?.map((one) => one.code)).toEqual(["unknown-target"])
  expect(outlinePaths(set)).toEqual(["attic.olai", "cellar.olai"])
  expect(documentAt(set, "attic.olai")).toEqual(outlineOf("", "attic.olai"))

  expect(brokenIn(set, "cellar.olai")).toBeUndefined()
})

test("a finding that names two files takes both, and only both", () => {
  const { set, dark } = degradedBy({
    "attic.olai": `{"id":"attic","ord":"a","title":"the attic"}\n` +
      `{"id":"boxes","parent":"attic","ord":"b","title":"the boxes"}`,
    "cellar.olai": `{"id":"boxes","ord":"a","title":"the crates"}`,
    "shed.olai": `{"id":"shed","ord":"a","title":"the shed"}`,
  })

  expect(dark).toEqual(["attic.olai", "cellar.olai"])
  expect(brokenBy(set).get("attic.olai")?.map((one) => one.code)).toEqual(["duplicate-id"])
  expect(brokenBy(set).get("cellar.olai")?.map((one) => one.code)).toEqual(["duplicate-id"])
  expect(brokenIn(set, "shed.olai")).toBeUndefined()
  expect(brokenBy(set).get("attic.olai")?.[0]).toBe(
    brokenBy(set).get("cellar.olai")?.[0] as OutlineError,
  )
  expect(findingsIn(set)).toHaveLength(1)
})

test("a mirror into a withheld file dangles, and does not break the file holding it", () => {
  const { set, dark } = degradedBy({
    "attic.olai": `{"id":"attic","ord":"a","title":"the attic"}\n` +
      `{"id":"lamps","parent":"attic","ord":"b","title":"the lamps"}\n` +
      `{"id":"attic","ord":"c","title":"claimed twice"}`,
    "plan.olai": `{"id":"plan","ord":"a","title":"the plan"}\n` +
      `{"id":"m","parent":"plan","ord":"b","mirror":"lamps"}`,
  })

  expect(dark).toEqual(["attic.olai"])
  expect(brokenIn(set, "plan.olai")).toBeUndefined()

  const view = reading(TEST_CLAIMS, set).derived
  expect(view.byId.has("lamps")).toBe(false)
  expect(view.namedBy.has("lamps")).toBe(true)
  const rows = rowsOf(view, "plan.olai")
  const mirror = rows[0]?.children[0]
  expect(mirror?.kind).toBe("dangling")
  expect(mirror?.kind === "dangling" ? mirror.missing : "").toBe("lamps")
})

test("a directory with nothing wrong comes back as the very set it was handed", () => {
  const set = setOf({
    "attic.olai": `{"id":"attic","ord":"a","title":"the attic"}`,
    "cellar.olai": `{"id":"cellar","ord":"a","title":"the cellar"}`,
  })
  const answer = validate(TEST_CLAIMS, set)
  if (Result.isFailure(answer)) throw new Error("expected a valid set")
  expect(answer.success.set).toBe(set)
  expect(answer.success.set.broken).toEqual([])
})
