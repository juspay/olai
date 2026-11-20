/**
 * `bun test` resolves SolidJS's SERVER build, whose `createResource` throws
 * outright (`getNextContextId cannot be used under non-hydrating context`) and
 * whose effects never re-run, so this runs under `--conditions browser` as a
 * SECOND command of the same `just test` leg. The filename is what keeps the
 * two apart: bun discovers `.test.` / `_test_` / `.spec.` / `_spec_` and
 * nothing else, so `.browsertest.` is invisible to the default run.
 *
 * Vendored solid-js 1.9.14 keeps the last resolved value when its source goes
 * falsy, so a door reading the resource straight through re-opens on the
 * previous popup's rows.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"
import { createRoot, createSignal } from "solid-js"

import { createSettled, SETTLE_MS } from "@olai/web/client/settled.ts"

const flying = () => new Promise((go) => setTimeout(go, SETTLE_MS + 60))
const landed = () => new Promise((go) => setTimeout(go, 10))

const server = () => {
  const asked: Array<string> = []
  const waiting = new Map<string, (rows: ReadonlyArray<string>) => void>()
  const refusing = new Map<string, (reason: unknown) => void>()
  return {
    asked,
    ask: (query: string) =>
      Effect.tryPromise({
        try: () => {
          asked.push(query)
          return new Promise<ReadonlyArray<string>>((ok, no) => {
            waiting.set(query, ok)
            refusing.set(query, no)
          })
        },
        catch: (cause) => cause,
      }),
    answer: (query: string, rows: ReadonlyArray<string>) => waiting.get(query)?.(rows),
    refuse: (query: string, why: string) => refusing.get(query)?.(new Error(why)),
  }
}

const over = async (
  body: (
    at: {
      readonly ask: (question: string | null) => void
      readonly settled: ReturnType<typeof createSettled<string, ReadonlyArray<string>>>
      readonly server: ReturnType<typeof server>
    },
  ) => Promise<void>,
): Promise<void> => {
  const fake = server()
  let dispose = (): void => {}
  const parts = createRoot((off) => {
    dispose = off
    const [question, ask] = createSignal<string | null>(null)
    return { ask, settled: createSettled(question, fake.ask), server: fake }
  })
  try {
    await body(parts)
  } finally {
    dispose()
  }
}

test("a question that goes away answers with nothing, not with the last list", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.answer("ho", ["#home", "#hob"])
    await landed()
    expect(asker.answer()).toEqual(["#home", "#hob"])
    expect(asker.answering()).toBe("ho")

    ask(null)
    expect(asker.answer()).toBeUndefined()
    expect(asker.answering()).toBeNull()
  })
})

test("the next session opens empty rather than on the last one's rows", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.answer("ho", ["#home"])
    await landed()

    ask(null)
    ask("al")
    await flying()
    expect(asker.answer()).toBeUndefined()
    expect(asker.answering()).toBeNull()

    fake.answer("al", ["@alice"])
    await landed()
    expect(asker.answer()).toEqual(["@alice"])
  })
})

test("rows the reader has typed past are not labelled as theirs", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.answer("ho", ["#home", "#hob"])
    await landed()
    expect(asker.answering()).toBe("ho")

    ask("hom")
    expect(asker.answer()).toEqual(["#home", "#hob"])
    expect(asker.answering()).toBeNull()

    await flying()
    fake.answer("hom", ["#home"])
    await landed()
    expect(asker.answering()).toBe("hom")
  })
})

test("holding still WITHIN one session is untouched", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.answer("ho", ["#home", "#hob"])
    await landed()

    ask("hom")
    await flying()
    expect(asker.answer()).toEqual(["#home", "#hob"])
    expect(asker.answering()).toBeNull()

    fake.answer("hom", ["#home"])
    await landed()
    expect(asker.answer()).toEqual(["#home"])
    expect(asker.answering()).toBe("hom")
  })
})

test("a refused call answers nothing and says why", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.refuse("ho", "the wire went")
    await landed()
    expect(asker.answer()).toBeUndefined()
    expect(asker.answering()).toBeNull()
    expect(asker.failure()).toContain("the wire went")

    ask(null)
    expect(asker.failure()).toBeNull()
  })
})

test("an equal question is one round trip, however many keystrokes it took", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.answer("ho", ["#home"])
    await landed()
    ask("ho")
    ask("ho")
    await flying()
    expect(fake.asked).toEqual(["ho"])
    expect(asker.answer()).toEqual(["#home"])
  })
})

test("a take spends nothing while the rows answer a question typed past", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.answer("ho", ["#home", "#hob"])
    await landed()

    let spent = 0
    asker.taking(() => ++spent)
    expect(spent).toBe(1)

    ask("hom")
    asker.taking(() => ++spent)
    expect(spent).toBe(1)

    await flying()
    fake.answer("hom", ["#home"])
    await landed()
    asker.taking(() => ++spent)
    expect(spent).toBe(2)
  })
})

test("a take spends nothing over a refused call, and nothing over no session", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    let spent = 0
    asker.taking(() => ++spent)

    ask("ho")
    await flying()
    fake.refuse("ho", "the wire went")
    await landed()
    asker.taking(() => ++spent)

    ask(null)
    asker.taking(() => ++spent)
    expect(spent).toBe(0)
  })
})
