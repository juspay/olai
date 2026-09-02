/**
 * THE CACHE'S OWN CONTRACT, against a repository made of a Map.
 *
 * `./pending.equivalence.test.ts` holds this against real git over a scripted
 * session and is where the claim actually lives; what is here is the half a
 * differential cannot show, which is WHAT WAS ASKED. A cache that re-read every
 * file every time would pass every equivalence in this tree — so the assertions
 * below are about the questions put to the repository: which commit they name,
 * how many there are, and which revisions owe one at all.
 *
 * The fake is a Map from `<sha>:<path>` because that is exactly what git's
 * object syntax names, and writing it that way is what makes the test read as
 * the claim: a commit's copy of a file is a key, and a key does not change.
 */

import type { Shown } from "@olai/git"
import { orgFixture } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Effect } from "effect"

import { type Asking, type Copy, remembering } from "./committed.ts"

/** A repository that remembers what it was asked. `head` is a mutable field so
 *  a test can land a commit between two asks, which is the whole subject — and
 *  `refuse` is the other one: a git that RAN and could not answer, which is the
 *  arm nothing may be remembered from. */
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
    /** Every `show` from here on comes back as git's own refusal — a bitten
     *  budget, a stream past the buffer — until {@link answering}. */
    refusing: (said: string) => {
      refusing = said
    },
    answering: () => {
      refusing = null
    },
  }
}

const node = (id: string, title: string): string =>
  orgFixture(`{"id":"${id}","ord":"a0","title":"${title}"}\n`)

const titles = (copy: Copy | undefined): ReadonlyArray<string> =>
  copy?._tag === "Nodes" ? copy.nodes.map((one) => ("title" in one ? one.title ?? "" : "")) : []

const OBJECTS = {
  "sha-one:a.org": node("a", "as one had it"),
  "sha-one:b.org": node("b", "b as one had it"),
  "sha-two:a.org": node("a", "as two has it"),
  "sha-two:b.org": node("b", "b as two has it"),
  "sha-one:broken.org": "this is not a node\n",
}

test("the commit is named in the question, so the answer belongs to that commit", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering()

  const first = await Effect.runPromise(committed.at(repo.git, ["a.org"]))
  expect(titles(first.get("a.org"))).toEqual(["as one had it"])
  // Never `HEAD:a.org`, which is the question whose answer moves.
  expect(repo.asked()).toEqual(["head", "sha-one:a.org"])
})

test("a second ask at the same commit reads nothing but which commit it is", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering()

  await Effect.runPromise(committed.at(repo.git, ["a.org", "b.org"]))
  repo.forget()
  const again = await Effect.runPromise(committed.at(repo.git, ["a.org", "b.org"]))

  expect(repo.asked()).toEqual(["head"])
  expect(titles(again.get("b.org"))).toEqual(["b as one had it"])
})

test("a commit landing is a new generation, not a stale answer", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering()

  await Effect.runPromise(committed.at(repo.git, ["a.org", "b.org"]))
  repo.moveTo("sha-two")
  repo.forget()
  const after = await Effect.runPromise(committed.at(repo.git, ["a.org", "b.org"]))

  expect(titles(after.get("a.org"))).toEqual(["as two has it"])
  expect(titles(after.get("b.org"))).toEqual(["b as two has it"])
  expect(repo.asked()).toEqual(["head", "sha-two:a.org", "sha-two:b.org"])
})

/** A `reset`, a checkout back, a rebase that lands where it started: the sha is
 *  one the generation before it held, and it is read again rather than being
 *  served out of a generation that is gone. Holding ONE generation is what
 *  bounds this thing, and paying a read for the walk back is what it costs. */
test("landing back on a commit already seen reads it again, and correctly", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering()

  await Effect.runPromise(committed.at(repo.git, ["a.org"]))
  repo.moveTo("sha-two")
  await Effect.runPromise(committed.at(repo.git, ["a.org"]))
  repo.moveTo("sha-one")
  repo.forget()
  const back = await Effect.runPromise(committed.at(repo.git, ["a.org"]))

  expect(titles(back.get("a.org"))).toEqual(["as one had it"])
  expect(repo.asked()).toEqual(["head", "sha-one:a.org"])
})

test("a path asked for twice in one revision is one question", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering()

  const answer = await Effect.runPromise(committed.at(repo.git, ["a.org", "a.org"]))

  expect(repo.asked()).toEqual(["head", "sha-one:a.org"])
  expect(titles(answer.get("a.org"))).toEqual(["as one had it"])
})

/** A commit that does not have the file is an answer worth remembering too: an
 *  untracked outline is the commonest dirty file there is, and re-asking about
 *  a file HEAD has never had would put the per-keystroke subprocess back for
 *  exactly the files a new vault is made of. */
test("a file the commit does not have is Absent, and is not asked about twice", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering()

  const first = await Effect.runPromise(committed.at(repo.git, ["new.org"]))
  expect(first.get("new.org")).toEqual({ _tag: "Absent" })
  repo.forget()
  await Effect.runPromise(committed.at(repo.git, ["new.org"]))
  expect(repo.asked()).toEqual(["head"])
})

/** ... and so is a committed copy that will not parse, which is a DIFFERENT
 *  answer: the panel says nothing can be read about that file, where `Absent`
 *  would have said every node in it is new. */
test("a committed copy that does not parse is Unparsed, and is remembered as that", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering()

  const first = await Effect.runPromise(committed.at(repo.git, ["broken.org"]))
  expect(first.get("broken.org")).toEqual({ _tag: "Unparsed" })
  repo.forget()
  const again = await Effect.runPromise(committed.at(repo.git, ["broken.org"]))
  expect(again.get("broken.org")).toEqual({ _tag: "Unparsed" })
  expect(repo.asked()).toEqual(["head"])
})

/** The clean directory, which is what a served vault is nearly all the time.
 *  Nothing dirty is nothing to compare, and this must not be the module that
 *  puts a subprocess back into that path. */
test("no dirty outlines is no question at all — not even which commit", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering()

  expect((await Effect.runPromise(committed.at(repo.git, []))).size).toBe(0)
  expect(repo.asked()).toEqual([])
})

/** A branch with no commits yet, and a git that could not be asked: one answer,
 *  and no `show` under it. Every node of every dirty outline reads as created,
 *  which is what a directory with no history is. */
test("no commit means no copies, asked for in one question", async () => {
  const repo = fake(OBJECTS, null)
  const committed = remembering()

  const answer = await Effect.runPromise(committed.at(repo.git, ["a.org", "b.org"]))

  expect(answer.get("a.org")).toEqual({ _tag: "Absent" })
  expect(answer.get("b.org")).toEqual({ _tag: "Absent" })
  expect(repo.asked()).toEqual(["head"])
})

/** The first commit landing under a directory that had none: nothing was
 *  remembered while there was no commit to remember it under, so the copies
 *  arrive the moment there is one. */
test("the first commit is a generation like any other", async () => {
  const repo = fake(OBJECTS, null)
  const committed = remembering()

  await Effect.runPromise(committed.at(repo.git, ["a.org"]))
  repo.moveTo("sha-one")
  repo.forget()
  const after = await Effect.runPromise(committed.at(repo.git, ["a.org"]))

  expect(titles(after.get("a.org"))).toEqual(["as one had it"])
  expect(repo.asked()).toEqual(["head", "sha-one:a.org"])
})

/**
 * A `show` GIT COULD NOT ANSWER is answered and dropped, never filed.
 *
 * THE REGRESSION THIS PINS is the one a memory owes a caller that used to
 * re-read. `git()` turns a bitten ten-second budget — plausible exactly in the
 * mass-dirty-after-a-pull shape the concurrency bound exists for — and a stream
 * past the buffer into a refusal, and the old per-file loop paid for that with
 * ONE bad revision and healed on the next. Filed, the same accident would
 * report every node of that file as CREATED until HEAD next moved: an alarming
 * panel, out of an answer nobody ever gave.
 *
 * WHAT IT READS AS for that one revision is what the old fold read — `Absent`,
 * which is the value every non-zero exit used to produce — and `./committed.ts`
 * says why that rather than the more informative `Unparsed`: the two arms of
 * the differential have to be the same function of what git said, or the
 * comparison stops being about the memory. The claim being pinned here is the
 * FILING, not the wording.
 */
test("a show git could not answer is not remembered, and is asked again", async () => {
  const repo = fake(OBJECTS, "sha-one")
  const committed = remembering()

  repo.refusing("fatal: git show did not finish within 10000ms")
  const bitten = await Effect.runPromise(committed.at(repo.git, ["a.org"]))
  expect(bitten.get("a.org")).toEqual({ _tag: "Absent" })

  repo.answering()
  repo.forget()
  const healed = await Effect.runPromise(committed.at(repo.git, ["a.org"]))
  expect(repo.asked()).toEqual(["head", "sha-one:a.org"])
  expect(titles(healed.get("a.org"))).toEqual(["as one had it"])

  // ... and THAT one is remembered, so the refusal left nothing behind that
  // outlives it.
  repo.forget()
  await Effect.runPromise(committed.at(repo.git, ["a.org"]))
  expect(repo.asked()).toEqual(["head"])
})

/** ... and it costs the files beside it nothing: a refusal is per ask, so the
 *  copies read in the same round are filed as usual. A generation is not
 *  poisoned by one file nobody could read. */
test("one unanswerable file does not stop the rest of the round being remembered", async () => {
  const repo = fake({ ...OBJECTS, "sha-one:c.org": node("c", "c as one had it") }, "sha-one")
  const committed = remembering()

  await Effect.runPromise(committed.at(repo.git, ["a.org"]))
  repo.refusing("fatal: git show did not finish within 10000ms")
  await Effect.runPromise(committed.at(repo.git, ["a.org", "b.org"]))
  repo.answering()
  repo.forget()

  const answer = await Effect.runPromise(committed.at(repo.git, ["a.org", "b.org", "c.org"]))
  // `a.org` was read before the refusal and is still known; `b.org` was the
  // one that could not be read and is asked again, beside the newcomer.
  expect(repo.asked()).toEqual(["head", "sha-one:b.org", "sha-one:c.org"])
  expect(titles(answer.get("a.org"))).toEqual(["as one had it"])
  expect(titles(answer.get("b.org"))).toEqual(["b as one had it"])
})
