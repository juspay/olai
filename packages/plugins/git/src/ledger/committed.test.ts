import { parsers } from "./parser.testlib.ts"
import type { Shown } from "../git/git.ts"
import { expect, test } from "bun:test"
import { Effect } from "effect"

import { type Asking, type Copy, remembering } from "./committed.ts"

const fake = (
  objects: Readonly<Record<string, string>>,
  head: string | null,
) => {
  const asked: Array<string> = []
  let at = head
  let refusing: string | null = null
  const git: Asking = {
    head: Effect.sync(() => {
      asked.push("head")
      return at
    }),
    show: (commit, path) =>
      Effect.sync((): Shown => {
        asked.push(`${commit}:${path}`)
        if (refusing !== null) return { _tag: "Unusable", said: refusing }
        const text = objects[`${commit}:${path}`]
        return text === undefined ? { _tag: "Absent" } : { _tag: "Text", text }
      }),
  }
  return {
    git,
    asked: (): ReadonlyArray<string> => [...asked],
    forget: () => asked.splice(0),
    moveTo: (sha: string | null) => {
      at = sha
    },
    refusing: (said: string) => {
      refusing = said
    },
    answering: () => {
      refusing = null
    },
  }
}

const node = (id: string, title: string): string => `{"id":"${id}","ord":"a0","title":"${title}"}\n`

const titles = (copy: Copy | undefined): ReadonlyArray<string> =>
  copy?._tag === "Nodes" ? copy.nodes.map((one) => ("title" in one ? one.title ?? "" : "")) : []

const OBJECTS = {
  "sha-one:a.olai": node("a", "as one had it"),
  "sha-one:b.olai": node("b", "b as one had it"),
  "sha-two:a.olai": node("a", "as two has it"),
  "sha-two:b.olai": node("b", "b as two has it"),
  "sha-one:broken.olai": "this is not a node\n",
}

test("the commit is named in the question, so the answer belongs to that commit", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering(parsers)

  const first = await Effect.runPromise(committed.at(repo.git, ["a.olai"]))
  expect(titles(first.get("a.olai"))).toEqual(["as one had it"])
  expect(repo.asked()).toEqual(["head", "sha-one:a.olai"])
})

test("a second ask at the same commit reads nothing but which commit it is", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering(parsers)

  await Effect.runPromise(committed.at(repo.git, ["a.olai", "b.olai"]))
  repo.forget()
  const again = await Effect.runPromise(committed.at(repo.git, ["a.olai", "b.olai"]))

  expect(repo.asked()).toEqual(["head"])
  expect(titles(again.get("b.olai"))).toEqual(["b as one had it"])
})

test("a commit landing is a new generation, not a stale answer", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering(parsers)

  await Effect.runPromise(committed.at(repo.git, ["a.olai", "b.olai"]))
  repo.moveTo("sha-two")
  repo.forget()
  const after = await Effect.runPromise(committed.at(repo.git, ["a.olai", "b.olai"]))

  expect(titles(after.get("a.olai"))).toEqual(["as two has it"])
  expect(titles(after.get("b.olai"))).toEqual(["b as two has it"])
  expect(repo.asked()).toEqual(["head", "sha-two:a.olai", "sha-two:b.olai"])
})

test("landing back on a commit already seen reads it again, and correctly", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering(parsers)

  await Effect.runPromise(committed.at(repo.git, ["a.olai"]))
  repo.moveTo("sha-two")
  await Effect.runPromise(committed.at(repo.git, ["a.olai"]))
  repo.moveTo("sha-one")
  repo.forget()
  const back = await Effect.runPromise(committed.at(repo.git, ["a.olai"]))

  expect(titles(back.get("a.olai"))).toEqual(["as one had it"])
  expect(repo.asked()).toEqual(["head", "sha-one:a.olai"])
})

test("a path asked for twice in one revision is one question", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering(parsers)

  const answer = await Effect.runPromise(committed.at(repo.git, ["a.olai", "a.olai"]))

  expect(repo.asked()).toEqual(["head", "sha-one:a.olai"])
  expect(titles(answer.get("a.olai"))).toEqual(["as one had it"])
})

test("a file the commit does not have is Absent, and is not asked about twice", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering(parsers)

  const first = await Effect.runPromise(committed.at(repo.git, ["new.olai"]))
  expect(first.get("new.olai")).toEqual({ _tag: "Absent" })
  repo.forget()
  await Effect.runPromise(committed.at(repo.git, ["new.olai"]))
  expect(repo.asked()).toEqual(["head"])
})

test("a committed copy that does not parse is Unparsed, and is remembered as that", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering(parsers)

  const first = await Effect.runPromise(committed.at(repo.git, ["broken.olai"]))
  expect(first.get("broken.olai")).toEqual({ _tag: "Unparsed" })
  repo.forget()
  const again = await Effect.runPromise(committed.at(repo.git, ["broken.olai"]))
  expect(again.get("broken.olai")).toEqual({ _tag: "Unparsed" })
  expect(repo.asked()).toEqual(["head"])
})

test("no dirty outlines is no question at all — not even which commit", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering(parsers)

  expect((await Effect.runPromise(committed.at(repo.git, []))).size).toBe(0)
  expect(repo.asked()).toEqual([])
})

test("no commit means no copies, asked for in one question", async () => {
  const repo = fake(OBJECTS, null)
  const committed = remembering(parsers)

  const answer = await Effect.runPromise(committed.at(repo.git, ["a.olai", "b.olai"]))

  expect(answer.get("a.olai")).toEqual({ _tag: "Absent" })
  expect(answer.get("b.olai")).toEqual({ _tag: "Absent" })
  expect(repo.asked()).toEqual(["head"])
})

test("the first commit is a generation like any other", async () => {
  const repo = fake(OBJECTS, null)
  const committed = remembering(parsers)

  await Effect.runPromise(committed.at(repo.git, ["a.olai"]))
  repo.moveTo("sha-one")
  repo.forget()
  const after = await Effect.runPromise(committed.at(repo.git, ["a.olai"]))

  expect(titles(after.get("a.olai"))).toEqual(["as one had it"])
  expect(repo.asked()).toEqual(["head", "sha-one:a.olai"])
})

test("a show git could not answer is not remembered, and is asked again", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering(parsers)

  repo.refusing("fatal: git show did not finish within 10000ms")
  const bitten = await Effect.runPromise(committed.at(repo.git, ["a.olai"]))
  expect(bitten.get("a.olai")).toEqual({ _tag: "Absent" })

  repo.answering()
  repo.forget()
  const healed = await Effect.runPromise(committed.at(repo.git, ["a.olai"]))
  expect(repo.asked()).toEqual(["head", "sha-one:a.olai"])
  expect(titles(healed.get("a.olai"))).toEqual(["as one had it"])

  repo.forget()
  await Effect.runPromise(committed.at(repo.git, ["a.olai"]))
  expect(repo.asked()).toEqual(["head"])
})

test("one unanswerable file does not stop the rest of the round being remembered", async () => {
  const repo = fake({ ...OBJECTS, "sha-one:c.olai": node("c", "c as one had it") }, "sha-one")
  const committed = remembering(parsers)

  await Effect.runPromise(committed.at(repo.git, ["a.olai"]))
  repo.refusing("fatal: git show did not finish within 10000ms")
  await Effect.runPromise(committed.at(repo.git, ["a.olai", "b.olai"]))
  repo.answering()
  repo.forget()

  const answer = await Effect.runPromise(committed.at(repo.git, ["a.olai", "b.olai", "c.olai"]))
  expect(repo.asked()).toEqual(["head", "sha-one:b.olai", "sha-one:c.olai"])
  expect(titles(answer.get("a.olai"))).toEqual(["as one had it"])
  expect(titles(answer.get("b.olai"))).toEqual(["b as one had it"])
})

test("committed copies use the path's format and retire when its Claims snapshot changes", async () => {
  const { claims, parserFor } = await import("@olai/format")
  const { TEST_CLAIMS } = await import("@olai/ops/testlib")
  const original = [...TEST_CLAIMS.byKind.values()].find(claim => claim.holds === "nodes")!
  const table = (prefix: string) => claims([{ ...original, kind: "alternate", exts: [".alternate"], format: {
    serialize: original.format!.serialize,
    parse: (file, contents, snapshot) => original.format!.parse(file, node("a", prefix + contents), snapshot),
  } }])
  let current = table("first: ")
  const committed = remembering({ parserFor: path => {
    const snapshot = current, format = parserFor(snapshot, path)
    return format === null ? null : { claims: snapshot, format }
  } })
  const repo = fake({ "sha-one:a.alternate": "format-specific bytes" }, "sha-one")
  expect(titles((await Effect.runPromise(committed.at(repo.git, ["a.alternate"]))).get("a.alternate"))).toEqual(["first: format-specific bytes"])
  current = claims([])
  expect((await Effect.runPromise(committed.at(repo.git, ["a.alternate"]))).get("a.alternate")?._tag).toBe("Absent")
  current = table("returned: ")
  expect(titles((await Effect.runPromise(committed.at(repo.git, ["a.alternate"]))).get("a.alternate"))).toEqual(["returned: format-specific bytes"])
})
