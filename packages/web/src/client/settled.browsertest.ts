/**
 * The asker every shortlist door in this client is built on — over the REAL
 * SolidJS, which is why this file is spelled the way it is.
 *
 * ## Why it is not `settled.test.ts`
 *
 * `bun test` resolves SolidJS's SERVER build, whose `createResource` throws
 * outright (`getNextContextId cannot be used under non-hydrating context`) and
 * whose effects never re-run. That is not a quirk to work around: it is the
 * same trap the tab's own frame bench named in its header before it was deleted
 * with the fold it timed, and it is why every other Solid
 * unit test in this client sticks to signals and memos. A primitive whose whole
 * subject is what a `createResource` does with a source that moved cannot be
 * asked under a build where there is no resource.
 *
 * So this runs under `--conditions browser`, as a SECOND command of the same
 * `just test` leg — one recipe, one CI node, and it fails the leg like any
 * other test. The filename is what keeps the two apart: bun discovers `.test.`
 * / `_test_` / `.spec.` / `_spec_` and nothing else, so `.browsertest.` is
 * invisible to the default run and named as a path by the second. Trying the
 * whole suite under the browser condition is not the alternative — it fails 59
 * tests in packages that legitimately want the server resolution.
 *
 * ## What it pins
 *
 * One rule, and the three neighbours that must not move when it is enforced: an
 * answer belongs to the SESSION it was asked in. Everything else here — the
 * settle, the failure slot, the fake server — is scaffolding for that sentence.
 *
 * The failing case came from opencode's review of PR #272, with a probe:
 * vendored solid-js 1.9.14 keeps the last resolved value when its source goes
 * falsy, so a door reading the resource straight through re-opened on the
 * previous popup's rows. For the tag completion that is not merely stale — the
 * rows are re-spelled with the trigger armed NOW, so a `#` session's names were
 * offered, and writable, under a later `@`.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"
import { createRoot, createSignal } from "solid-js"

import { createSettled, SETTLE_MS } from "./settled.ts"

/** Past the settle, so the call is OUT — and no further, because nothing here
 *  resolves on its own. Real timers, because the debounce is a real one: this
 *  file is about the primitive as it actually runs, and a fake clock would be a
 *  fourth thing to believe. */
const flying = () => new Promise((go) => setTimeout(go, SETTLE_MS + 60))
/** ...and past the continuation an answered call resolves on. A tick, not a
 *  settle: what is being waited for here is a promise this file just kept. */
const landed = () => new Promise((go) => setTimeout(go, 10))

/** A server that answers when this file says so, and remembers what it was
 *  asked — so "an equal question is not a second round trip" is a count rather
 *  than a belief. */
const server = () => {
  const asked: Array<string> = []
  const waiting = new Map<string, (rows: ReadonlyArray<string>) => void>()
  const refusing = new Map<string, (reason: unknown) => void>()
  return {
    asked,
    ask: (query: string) =>
      // The raw cause through, rather than `tryPromise`'s own wrapper, so what
      // reaches the failure slot is the server's sentence — which is what
      // `../run.ts`'s `asFailure` does with anything that is not a declared
      // refusal, and what a reader would see.
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
    /** Answer one outstanding question. */
    answer: (query: string, rows: ReadonlyArray<string>) => waiting.get(query)?.(rows),
    refuse: (query: string, why: string) => refusing.get(query)?.(new Error(why)),
  }
}

/** One asker, driven by a question this test sets, inside a root that is
 *  disposed afterwards — the same shape `search/cursor.test.ts` uses. */
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

// ── the finding: a session that ended takes its answer with it ──────────

test("a question that goes away answers with nothing, not with the last list", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.answer("ho", ["#home", "#hob"])
    await landed()
    expect(asker.answer()).toEqual(["#home", "#hob"])
    expect(asker.answering()).toBe("ho")

    // The caret moves off the tag, Escape shuts the popup, the row is taken —
    // every one of those is the question going away, and `createResource` keeps
    // its value through all of them. This is the guard the framework does not
    // give (`./settled.ts`).
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

    // Popup shut, popup opened again — under the OTHER sigil, which is the case
    // that makes this a correctness rule and not a staleness preference: the
    // widget re-spells every row with the trigger that is armed now, so `#home`
    // held here would be offered as `@home`, a tag the set does not hold.
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

// ── ...and the second finding: the settle is part of "moved on" ─────────

test("rows the reader has typed past are not labelled as theirs", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.answer("ho", ["#home", "#hob"])
    await landed()
    expect(asker.answering()).toBe("ho")

    // One more character, and NOTHING waited out — which is where a door's
    // `Enter` actually lands, because the settle exists precisely so that a
    // person typing at speed is not asking. The rows stay (they are the only
    // honest thing to draw), and they stop being about the reader the instant
    // the reader typed past them. This used to compare the answer against what
    // had been ASKED, and `asked` does not move until the debounce fires — so
    // for 200ms the rows were labelled as the reader's own, and a door that
    // takes one on `Enter` took the wrong node
    // (`https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/reactivity-after-the-flip.md`'s 4.12).
    ask("hom")
    expect(asker.answer()).toEqual(["#home", "#hob"])
    expect(asker.answering()).toBeNull()

    // ...and it comes back the moment the answer is about the question again.
    await flying()
    fake.answer("hom", ["#home"])
    await landed()
    expect(asker.answering()).toBe("hom")
  })
})

// ── ...and the three things that must NOT change with it ────────────────

test("holding still WITHIN one session is untouched", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.answer("ho", ["#home", "#hob"])
    await landed()

    // A longer prefix, with no clear in between: the rows a reader is looking at
    // stay until the next ones arrive, which is the only honest thing to draw
    // during a settle and a flight — and they are UNLABELLED while they wait.
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

    // ...and a session that ends clears the bad news with the rows: a refusal is
    // about the question it was refused for.
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
    // The caret walking inside `#home`, or typing elsewhere in the title, hands
    // the door the same question in a new frame. Neither the timer nor the wire
    // may hear about it — and a WHOLE SETTLE is waited out here, so "no second
    // call" is a fact rather than a race this test happened to win.
    ask("ho")
    ask("ho")
    await flying()
    expect(fake.asked).toEqual(["ho"])
    expect(asker.answer()).toEqual(["#home"])
  })
})

// ── the taker: the label, as an act ────────────────────────────────────
//
// `answering` was right at the two doors somebody was thinking about and
// unread at the three next to them, because a fact a caller must remember to
// consult is a fact a caller forgets. What every door actually does with the
// label is TAKE A ROW, so the primitive hands back the take.

test("a take spends nothing while the rows answer a question typed past", async () => {
  await over(async ({ ask, settled: asker, server: fake }) => {
    ask("ho")
    await flying()
    fake.answer("ho", ["#home", "#hob"])
    await landed()

    let spent = 0
    asker.taking(() => ++spent)
    expect(spent).toBe(1)

    // One more character, nothing waited out — where a door's `Enter` actually
    // lands. The rows stay on screen and stop being spendable in the same
    // instant.
    ask("hom")
    asker.taking(() => ++spent)
    expect(spent).toBe(1)

    // ...and the moment the answer is about the question again, the same press
    // means what it says.
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
    // Nothing has answered at all: there is no row to take and the act must
    // not run on the strength of an empty list.
    asker.taking(() => ++spent)

    ask("ho")
    await flying()
    fake.refuse("ho", "the wire went")
    await landed()
    // A refused call answers nothing and so names nothing — there is no answer
    // for a row to have come out of.
    asker.taking(() => ++spent)

    ask(null)
    asker.taking(() => ++spent)
    expect(spent).toBe(0)
  })
})
