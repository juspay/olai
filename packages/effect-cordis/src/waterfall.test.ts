/**
 * THE WATERFALL, with toy middleware — the properties a caller depends on and
 * one it must not.
 *
 * The one it must NOT is the ORDER, and it is asserted here anyway: what this
 * file pins is that the chain runs in REGISTRATION order, so that a caller who
 * needs a different one knows it has to impose it on the result.
 *
 * TWO OF THEM ARE ABOUT A DYING LINK, and they are the two halves of one rule:
 * a link that dies without calling through has not consulted the rest of the
 * chain, so the rest is still asked; a link that dies after calling through has
 * already had its answer, so the rest is NOT asked again. Only one of these was
 * here, and it asserted the opposite of what its own title said.
 *
 * ...AND THREE OF THEM ARE ABOUT A CUT LINK, which is the same rule one
 * occasion over: a plugin that leaves mid-dispatch has its link interrupted
 * rather than waited out, and how far that link had got decides what the chain
 * owes. They are below, together, because the three answers are only legible
 * beside each other.
 *
 * THE VALUES ARE IMMUTABLE, and that is load-bearing rather than tidy. The
 * fixtures used to push into a shared array, which made "the value the link was
 * handed" and "what the chain had accumulated" the same object — so a case
 * whose whole subject is the difference between them could not state it. What a
 * link DID is counted now; what the chain ANSWERED is read off the value.
 */

import { expect, test } from "bun:test"
import { Deferred, Effect, Fiber } from "effect"

import { mountPlugin, openHost } from "./host.ts"
import { definePlugin, PluginName } from "./plugin.ts"
import { waterfall } from "./waterfall.ts"

interface Opening {
  readonly said: ReadonlyArray<string>
}

const Opening = waterfall<Opening>("opening")

/** One plugin that pushes its own word and calls through. */
const speaker = (name: string) =>
  definePlugin({
    name,
    needs: [Opening.key],
    apply: Effect.gen(function*() {
      const chain = yield* Opening.key
      const who = yield* PluginName
      yield* chain.use((value, next) =>
        Effect.suspend(() => next({ said: [...value.said, who] }))
      )
    }),
  })

/**
 * ...AND THE SAME PLUGIN WITH AN EAGER BODY, which is the fixture this file did
 * not have and needed.
 *
 * `Middleware` is `(value, next) => Effect<A>` and puts no laziness obligation
 * on a plugin: a link may do its work on the way to RETURNING an effect, and
 * two of the three real waterfall links in this tree could be written that way
 * tomorrow. Every fixture above happens to wrap its body in an
 * `Effect.suspend`, which meant a dispatch that ran the middleware FUNCTION
 * before consulting the gate would have been invisible here. It was.
 */
const eagerSpeaker = (name: string) =>
  definePlugin({
    name,
    needs: [Opening.key],
    apply: Effect.gen(function*() {
      const chain = yield* Opening.key
      const who = yield* PluginName
      yield* chain.use((value, next) => next({ said: [...value.said, who] }))
    }),
  })

test("every mounted plugin sees one dispatch, in registration order", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    yield* mountPlugin(host, speaker("one"))
    yield* mountPlugin(host, speaker("other"))
    const opened = yield* dispatch({ said: [] })
    expect(opened.said).toEqual(["one", "other"])
  })))
})

test("a plugin that unloads is off the chain", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    const one = yield* mountPlugin(host, speaker("one"))
    yield* mountPlugin(host, speaker("other"))
    yield* one.dispose
    expect((yield* dispatch({ said: [] })).said).toEqual(["other"])
  })))
})

for (const [shape, make] of [["a suspended", speaker], ["an eager", eagerSpeaker]] as const) {
test(`a link whose plugin unloads mid-dispatch is skipped, and the chain carries on (${shape} body)`, async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    // OFF THE ROSTER IS NOT OFF THE WALK: the dispatch took its snapshot before
    // "leaver" stopped, so the copy still names it. What must not happen is the
    // walk CALLING it — and what must also not happen is the links after it
    // losing their say, which is why a shut gate resumes the chain rather than
    // answering with the value in hand.
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    const entered = Deferred.makeUnsafe<void>()
    const resume = Deferred.makeUnsafe<void>()
    yield* mountPlugin(host, definePlugin({
      name: "slow",
      needs: [Opening.key],
      apply: Effect.gen(function*() {
        const chain = yield* Opening.key
        yield* chain.use((value, next) =>
          Effect.gen(function*() {
            yield* Deferred.succeed(entered, undefined)
            yield* Deferred.await(resume)
            return yield* next({ said: [...value.said, "slow"] })
          })
        )
      }),
    }))
    const leaving = yield* mountPlugin(host, make("leaver"))
    yield* mountPlugin(host, make("other"))
    const opening = yield* Effect.forkScoped(dispatch({ said: [] }))
    yield* Deferred.await(entered)
    yield* leaving.dispose
    yield* Deferred.succeed(resume, undefined)
    expect((yield* Fiber.join(opening)).said).toEqual(["slow", "other"])
  })))
})
}

/**
 * THE THREE STATES A CUT LINK CAN BE IN, and they want three different answers.
 *
 * A link runs on its own fiber now, so a plugin leaving mid-dispatch CUTS its
 * link rather than being waited out. What the chain then owes depends on how
 * far that link had got — and the fact that makes all three safe is structural:
 * `next` does not run the rest of the chain inside the link. It ASKS for it,
 * and the dispatcher runs it on its own fiber. So cutting a link never touches
 * work that belongs to anybody else.
 *
 * The values are immutable here, unlike the fixtures above, because that is the
 * only way to tell "the value this link was handed" apart from "what it passed
 * on" — which is exactly what the three answers differ in.
 */
for (const cutAt of ["before it asked", "after its answer came back", "while its answer was being worked out"] as const) {
  test(`a link cut ${cutAt} leaves the chain honest`, async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const host = yield* openHost
      const dispatch = yield* Opening.open(host)
      const parked = Deferred.makeUnsafe<void>()
      const released = Deferred.makeUnsafe<void>()
      /** How many times the link AFTER the cut one ran to completion — the
       *  double-dispatch question and the killed-downstream question, in one
       *  number. */
      let inner = 0
      const leaving = yield* mountPlugin(host, definePlugin({
        name: "leaver",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use((value, next) =>
            Effect.gen(function*() {
              if (cutAt === "before it asked") {
                yield* Deferred.succeed(parked, undefined)
                yield* Effect.never
              }
              const carried = yield* next({ said: [...value.said, "leaver"] })
              if (cutAt === "after its answer came back") {
                yield* Deferred.succeed(parked, undefined)
                yield* Effect.never
              }
              return { said: [...carried.said, "leaver came out"] }
            })
          )
        }),
      }))
      yield* mountPlugin(host, definePlugin({
        name: "inner",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use((value, next) =>
            Effect.gen(function*() {
              if (cutAt === "while its answer was being worked out") {
                yield* Deferred.succeed(parked, undefined)
                yield* Deferred.await(released)
              }
              const carried = yield* next({ said: [...value.said, "inner"] })
              inner += 1
              return carried
            })
          )
        }),
      }))
      const opening = yield* Effect.forkScoped(dispatch({ said: [] }))
      yield* Deferred.await(parked)
      yield* leaving.dispose
      if (cutAt === "while its answer was being worked out") {
        // THE DOWNSTREAM SURVIVED ITS OUTER LINK. It was still running when the
        // leaver was cut, on the dispatcher's fiber rather than inside the
        // leaver's, so nothing about that cut reached it.
        expect(inner).toBe(0)
        yield* Deferred.succeed(released, undefined)
      }
      const opened = yield* Fiber.join(opening)
      // ASKED EXACTLY ONCE, whichever moment the cut landed on: never skipped
      // because its outer link left, and never re-run because the dispatch
      // resumed at a link that had already been consulted.
      expect(inner).toBe(1)
      expect(opened.said).toEqual(cutAt === "before it asked"
        // NEVER ASKED, so the leaver consulted nobody and the chain resumes at
        // the next link with the value the leaver was handed — which carries no
        // "leaver" on it, because it never passed one on.
        ? ["inner"]
        // ASKED, so the rest has already run and is not re-run. The value comes
        // back as the leaver was handed it: the leaver may have done half of
        // what it meant to with the answer, and a half-transformed value is not
        // something to pass on.
        : [])
    })))
  })
}

test("a middleware that dies is contained, and the rest of the chain runs", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    yield* mountPlugin(
      host,
      definePlugin({
        name: "broken",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use(() => Effect.die(new Error("nope")))
        }),
      }),
    )
    yield* mountPlugin(host, speaker("other"))
    // THE PLUGIN AFTER IT IS STILL ASKED. The dying link never called through,
    // so it has not consulted the rest of the chain and the rest is not its to
    // skip: the dispatch resumes at the next link with the value the broken one
    // was handed. What is contained is the death — the dispatch answers rather
    // than failing — and what is NOT swallowed with it is everybody else's say.
    expect((yield* dispatch({ said: [] })).said).toEqual(["other"])
  })))
})

test("a link that dies AFTER calling through does not re-ask the rest", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    // It calls `next` — so "other" below has already had its say — and THEN
    // dies on what it meant to do with the answer. Resuming the chain here
    // would ask "other" a second time, which is the double-ask this waterfall
    // exists to make impossible (a doorbell asked twice starts a daemon twice).
    yield* mountPlugin(
      host,
      definePlugin({
        name: "late",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use((value, next) =>
            Effect.flatMap(next(value), () => Effect.die(new Error("nope")))
          )
        }),
      }),
    )
    // COUNTED RATHER THAN READ OFF THE VALUE. The value comes back as the dying
    // link was handed it — it may have done half of what it meant to, and a
    // half-transformed value is not something to pass on — so what "other" did
    // is not visible in the answer, and the claim here is about how many times
    // it was ASKED.
    let asked = 0
    yield* mountPlugin(host, definePlugin({
      name: "other",
      needs: [Opening.key],
      apply: Effect.gen(function*() {
        const chain = yield* Opening.key
        yield* chain.use((value, next) =>
          Effect.suspend(() => {
            asked += 1
            return next(value)
          })
        )
      }),
    }))
    const opened = yield* dispatch({ said: [] })
    // ONCE: resuming the chain here would ask "other" a second time, which is
    // the double-ask this waterfall exists to make impossible.
    expect(asked).toBe(1)
    expect(opened.said).toEqual([])
  })))
})

test("a link may short-circuit the chain", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    yield* mountPlugin(
      host,
      definePlugin({
        name: "gate",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use((value) => Effect.succeed({ said: [...value.said, "gate"] }))
        }),
      }),
    )
    yield* mountPlugin(host, speaker("never"))
    expect((yield* dispatch({ said: [] })).said).toEqual(["gate"])
  })))
})
