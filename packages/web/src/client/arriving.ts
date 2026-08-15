/**
 * A CHUNK's arrival: not here, here, or not coming.
 *
 * Two things in this client are fetched after the page is drawn rather than
 * with it — the markdown pipeline (`markdown/chunk.ts`, ~390 kB) and the `•••`
 * menu's primitive (`menu/chunk.ts`, ~80 kB) — and both had spelled the same
 * four rules around their own `import()`. The second one is what made them
 * one thing rather than a coincidence, which is the same argument `saying.ts`
 * graduated on: the constant was half the job, and the machinery around it had
 * already drifted into two shapes for one set of rules.
 *
 * THE FOUR RULES, in one place:
 *
 *   - **one signal over the three states.** Two signals would be two writes to
 *     keep in step, and a state that said both "failed" and "here" is a state
 *     nothing should be able to spell.
 *   - **asking is what fetches it.** {@link Arrival.ready} is a signal read, so
 *     a memo (or a `<Show>`) that asks becomes one that re-runs when the file
 *     lands — and the first ask is what starts the fetch, so a page that never
 *     asks never pays. Solid's own `lazy` works this way for the same reason:
 *     the thing that needs it is the thing that knows.
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
export const arriving = <T>(what: string, fetch: () => Promise<T>): Arrival<T> => {
  const [arrival, setArrival] = createSignal<T | Error | undefined>(undefined)
  /** Has the fetch been started? Not a signal: nothing draws from it, and it is
   *  the one piece of this that must not re-run anything when it changes. */
  let asked = false
  const install = (value: T): void => {
    setArrival(() => value)
  }

  return {
    install,
    ready: () => {
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
      return here !== undefined && !(here instanceof Error)
    },
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
