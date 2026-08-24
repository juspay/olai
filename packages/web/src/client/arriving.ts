/**
 * A CHUNK's arrival: not here, here, or not coming.
 *
 * Two things in this client are fetched after the page is drawn rather than
 * with it — the markdown pipeline (`markdown/chunk.ts`, ~390 kB) and the `•••`
 * menu's primitive (`menu/chunk.ts`, ~80 kB) — and both had spelled the same
 * five rules around their own `import()`. The second one is what made them
 * one thing rather than a coincidence, which is the same argument `saying.ts`
 * graduated on: the constant was half the job, and the machinery around it had
 * already drifted into two shapes for one set of rules.
 *
 * THE FIVE RULES, in one place:
 *
 *   - **one signal over the three states.** Two signals would be two writes to
 *     keep in step, and a state that said both "failed" and "here" is a state
 *     nothing should be able to spell.
 *   - **asking is what fetches it.** {@link Arrival.ready} is a signal read, so
 *     a memo (or a `<Show>`) that asks becomes one that re-runs when the file
 *     lands — and the first ask is what starts the fetch, so a page that never
 *     asks never pays. Solid's own `lazy` works this way for the same reason:
 *     the thing that needs it is the thing that knows. (A consumer may decide
 *     otherwise for its own chunk, and one has: the shell `modulepreload`s the
 *     markdown pipeline, so asking there starts the EVALUATION and the bytes
 *     were already on their way — `markdown/chunk.ts` says why. Nothing here
 *     changes; a preload is a fact about the document, not about this.)
 *   - **a failure is a value, not a throw.** It is remembered, said in the
 *     console, and left for whoever was waiting to put on the page. A page that
 *     is missing a renderer or a menu is still a page somebody can read, and
 *     taking it down would replace something they can read with something they
 *     cannot (HACKING.md's error rule, answered at the surface rather than
 *     here). There is no retry loop either: a reload is the honest answer, and
 *     a loop of failing imports is a page that gets slower the longer it is
 *     broken.
 *   - **the value is stored as a value**, whatever it is. A component is a
 *     FUNCTION, and a bare `set(fn)` is read by Solid as an updater — the one
 *     footgun in this shape, spelled once here instead of once per caller.
 *   - **the flag that says the fetch has started is NOT a signal.** It was a
 *     comment on a `let` in both copies; it is a rule, because it is the one
 *     thing here that a reader would reasonably reach for a signal for. See
 *     `asked` below for what depends on it.
 *
 * WHAT IS NOT HERE is the `import()`. The bundler READS that specifier out of
 * the file it is written in, which is what puts the chunk in a file of its own
 * rather than merely unreached inside the entry — so it stays a literal in the
 * caller, and this takes the thunk around it.
 */

import { createSignal } from "solid-js"

export interface Arrival<T> {
  /** Is it here yet — and, if it is not, start fetching it. */
  readonly ready: () => boolean
  /**
   * Is it still COMING — not here, and not known to be lost.
   *
   * The third state, answered here rather than left to each surface to build
   * out of the other two. "Not ready" is two situations that must look
   * different on a page: something is on its way, and nothing is. A caller
   * that spelled `!ready()` for the first would dress a page that is never
   * going to change as though it were about to (`markdown/title.ts` did, for
   * one commit: a title with marks in it stayed blurred forever when the
   * renderer failed to load, which is the one case the blur must not cover).
   *
   * Reading this ASKS, exactly as {@link ready} does: the two answer the same
   * signal, so whichever a surface reads is what starts the fetch and what
   * re-runs it when the answer changes.
   */
  readonly waiting: () => boolean
  /** Why it is not coming, once that is known. Reactive, for whoever says so
   *  on the page. */
  readonly failure: () => Error | undefined
  /** It, for code that has already established {@link ready}. Throws rather
   *  than answering `undefined`: every caller is inside something that just
   *  asked, so this is a bug in the app's own ordering and a silent nothing
   *  would hide it behind a page that merely looked blank. */
  readonly now: () => T
  /** Hand it over directly — for a unit test, which has no bundler splitting
   *  anything and imports the real module itself. Re-export it only where a
   *  test uses it. */
  readonly install: (value: T) => void
}

/**
 * @param what the thing being fetched, as a noun phrase a reader would
 * recognise on a page ("the markdown renderer"). It is the whole of what the
 * two messages below are written from, which is why it is a sentence fragment
 * rather than a module name.
 * @param fetch the `import()`, written as a literal in the caller.
 */
export const createArrival = <T>(what: string, fetch: () => Promise<T>): Arrival<T> => {
  const [arrival, setArrival] = createSignal<T | Error | undefined>(undefined)
  /**
   * Has the fetch been started? A plain `let`, and the fifth rule above:
   * nothing draws from it, and it is the one piece of this that must not
   * re-run anything when it changes.
   *
   * IT IS WRITTEN INSIDE A SIGNAL READ, which is worth being explicit about
   * because {@link Arrival.ready} is called from TRACKED scopes — a memo in
   * `../markdown/render.ts`'s callers, a `<Show>` in `menu/NodeMenu.tsx` — and
   * a read that writes is a thing to look twice at. What makes it safe is that
   * this cell is NOT REACTIVE: the write notifies nothing, so it cannot
   * re-enter the computation that made it, and it is idempotent besides (the
   * guard is `!asked`; `arriving.test.ts` holds three reads to one fetch). A
   * signal here would be a computation writing to something it also reads,
   * which is a loop, and it would be one per caller rather than one here.
   *
   * That it behaves that way from inside a real computation is held where it
   * can be: `features/menu_arrives.feature`'s third scenario reads this from a
   * `<Show>` in a browser, holds the chunk up, and lands it — the panel
   * appearing IS the memo re-running. A unit test cannot say it, because
   * `bun test` resolves Solid's server build, where a memo is computed once
   * and no signal write propagates (checked: a plain `createSignal` →
   * `createMemo` does not update there either).
   */
  let asked = false
  const install = (value: T): void => {
    setArrival(() => value)
  }

  /** The fetch, started by the first read of {@link Arrival.ready} or
   *  {@link Arrival.waiting} — whichever a surface happens to ask first. It is
   *  the same question asked two ways, so the start of the fetch belongs to
   *  neither of them alone. */
  const askedFor = (): T | Error | undefined => {
    const here = arrival()
    if (here === undefined && !asked) {
      asked = true
      void fetch().then(install, (cause: unknown) => {
        const error = new Error(
          `${what} could not be loaded: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
          { cause },
        )
        console.error(error)
        setArrival(error)
      })
    }
    return here
  }

  return {
    install,
    ready: () => {
      const here = askedFor()
      return here !== undefined && !(here instanceof Error)
    },
    waiting: () => askedFor() === undefined,
    failure: () => {
      const here = arrival()
      return here instanceof Error ? here : undefined
    },
    now: () => {
      const here = arrival()
      if (here === undefined || here instanceof Error) {
        throw new Error(`${what} was used before it arrived — its ready() answers first`)
      }
      return here
    },
  }
}
