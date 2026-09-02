/**
 * THE FAILURE SLOT THE WHOLE TAB SHARES, and the one rule a shared slot has:
 * an older batch may not take back what a newer one said.
 *
 * The defect it is written against is the audit's 4.13
 * (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md`). Batches overlap by
 * construction — `askAll` clears the gather BEFORE its call goes, so the ids
 * wanted while one question is in flight leave on the next — and they come back
 * in any order. The slot was last-to-SETTLE-wins, so a slow refusal of an older
 * batch landing after a newer batch succeeded put a sentence back on screen
 * about a socket that had just answered, and left it there: nothing else clears
 * the slot, and for a settled transcript there is no next question to move it.
 * The reverse costs as much — an older success clearing a newer failure is a
 * conversation whose spans quietly never mark, which is the silent failure
 * the error rule forbids.
 *
 * ## Why it is a `.browsertest.ts`
 *
 * `./settled.browsertest.ts` argues this in full and it holds here word for
 * word: `bun test` resolves SolidJS's SERVER build, where an EFFECT never runs
 * at all — and the asking in `./declared.ts` IS an effect, so every case below
 * would pass under it having sent nothing. The second command of the same
 * `just test` leg names this path.
 *
 * ## The wire, mocked — the one thing this suite does that its neighbours do not
 *
 * `./declared.ts` reaches for the wire itself (`../wire.ts`'s `olai` and
 * `connectionReadout`) rather than taking an asker, which is right for what it
 * is: a module-level batcher every message on screen shares, with no door to
 * hand one in through. That module opens a websocket at import, so it is
 * replaced here — `mock.module` first, `await import` after, because a static
 * import would be hoisted above the mock.
 */

import { expect, mock, test } from "bun:test"
import { Effect } from "effect"
import { createRoot } from "solid-js"

/** A call the fake wire has taken and not yet answered. */
interface Outstanding {
  readonly ids: ReadonlyArray<string>
  readonly ok: (named: { named: ReadonlyArray<{ asked: string; id: string }> }) => void
  readonly no: (cause: unknown) => void
}

const calls: Array<Outstanding> = []

mock.module("../wire.ts", () => ({
  olai: {
    procedures: {
      nodes: {
        named: (request: { readonly ids: ReadonlyArray<string> }) =>
          // The raw cause through, as `./settled.browsertest.ts`'s fake server
          // does and for its reason: what reaches the slot is the sentence a
          // reader would see (`../run.ts`'s `asFailure`).
          Effect.tryPromise({
            try: () =>
              new Promise<{ named: ReadonlyArray<{ asked: string; id: string }> }>(
                (ok, no) => {
                  calls.push({ ids: request.ids, ok, no })
                },
              ),
            catch: (cause) => cause,
          }),
      },
    },
  },
  connectionReadout: () => ({ status: "live" }),
}))

const { createDeclared, declaringFailure } = await import("./declared.ts")

/** Past the gather (`GATHER_MS` is a zero timeout, which is "after this task")
 *  and past the continuation an answered call resolves on. Real timers, because
 *  the gather is a real one. */
const tick = () => new Promise((go) => setTimeout(go, 10))

/**
 * One message asking about one id, and the call that carries it.
 *
 * A ROOT PER MESSAGE, disposed at the end, because that is what a message is:
 * `createDeclared` holds an effect, and an effect outside an owner is a leak
 * the next test would inherit.
 */
const asking = async (id: string): Promise<Outstanding> => {
  const before = calls.length
  createRoot(() => {
    createDeclared().want([id])
  })
  await tick()
  const call = calls[before]
  if (call === undefined) throw new Error(`nothing asked about ${id}`)
  return call
}

test("an older batch's refusal does not take back a newer batch's clear", async () => {
  // TWO BATCHES, and the gather is what makes them two: the first question has
  // already left by the time the second message wants anything, so its ids
  // cannot join it (`./declared.ts`'s `askAll`).
  const first = await asking("herbs")
  const second = await asking("mint")
  expect(first).not.toBe(second)

  // The NEWER one answers, and the slot says there is nothing wrong.
  second.ok({ named: [{ asked: "mint", id: "mint" }] })
  await tick()
  expect(declaringFailure()).toBeNull()

  // ...and then the OLDER one, which left first and is still in flight, is
  // refused. It is one sentence out of date about a socket that answered a
  // moment ago, and nothing would ever clear it.
  first.no(new Error("the wire went"))
  await tick()
  expect(declaringFailure()).toBeNull()
})

test("...and an older batch's success does not clear a newer batch's refusal", async () => {
  // The same rule the other way up, which is the half that hides a real
  // failure: a conversation whose spans never mark, saying nothing about it.
  const first = await asking("compost")
  const second = await asking("slugs")

  second.no(new Error("the wire went"))
  await tick()
  expect(declaringFailure()).toContain("the wire went")

  first.ok({ named: [{ asked: "compost", id: "compost" }] })
  await tick()
  expect(declaringFailure()).toContain("the wire went")
})

test("the newest batch is still what the slot says", async () => {
  // The rule is an ORDER, not a latch: a refusal from the newest question is
  // the sentence on screen, and the next question clearing it is what takes it
  // away. Without this, "an older batch may not speak" would be indoor
  // plumbing for "the slot never moves again".
  const first = await asking("frames")
  first.no(new Error("the wire went"))
  await tick()
  expect(declaringFailure()).toContain("the wire went")

  const second = await asking("glazing")
  second.ok({ named: [] })
  await tick()
  expect(declaringFailure()).toBeNull()
})
