/**
 * When the `•••` menu's primitive arrives.
 *
 * `./Dropdown.tsx` is a chunk of its own (~85 kB raw, ~24 kB brotli, nearly all
 * of it `@kobalte/core`'s `DropdownMenu`) and the first paint of an outline does
 * not wait for it: a tree of titles, checkboxes and badges — with a `•••` beside
 * every row (`./Dots.tsx`) — is drawn out of `main-*.js` alone, and this file is
 * what fetches the rest, the first time somebody reaches for a menu, and never
 * on a page where nobody does.
 *
 * The `import()` below is the WHOLE of the request, exactly as it is in
 * `../markdown/chunk.ts`: `buildSurfaceClient` splits on a dynamic import and
 * names chunks with the same `[hash]` the entry gets (kolu#2159), so the panel
 * lands in the same immutable `/assets/` dir and the entry references it by a
 * URL that resolves inside it. Nothing here has to know that URL.
 *
 * ## The second half of a cost the row already halves
 *
 * A row pays for its menu twice, in two different currencies, and both are due
 * at the same instant — the first time that row is asked for its menu:
 *
 *   - **per row, every row, at runtime**: a shut `DropdownMenu` is an
 *     `IntersectionObserver`, a deferred timer, four locale subscriptions and a
 *     few dozen signals (140 of each on this app's own roadmap). That is what
 *     the lazy mount refuses — `./Dots.tsx`, `./door.ts`.
 *   - **once, for the whole app, on the wire**: the bytes above, which the lazy
 *     mount does nothing about because the entry imported the module either way.
 *     That is this file.
 *
 * So `./NodeMenu.tsx` gates one `<Show>` on both, and the ASK is the same ask:
 * `door.armed() && menuReady()`. Reading {@link menuReady} is what starts the
 * fetch, so a page nobody opens a menu on never asks — and JavaScript's own
 * `&&` is what makes "not until a row is armed" true rather than a rule
 * somebody has to keep.
 *
 * ## Why not Solid's `lazy`
 *
 * It is the same idea and it would be the ecosystem's spelling of it (`lazy`
 * is a resource, read where it is rendered), but it comes with two things this
 * surface cannot take, and this client has neither a `Suspense` nor an
 * `ErrorBoundary` anywhere:
 *
 *   - a `lazy` component with no `Suspense` above it renders NOTHING while it
 *     is in flight, so the `•••` a person just pressed would vanish from under
 *     the pointer and the gutter would twitch. One `Suspense` per row to avoid
 *     that is a per-row cost, which is the exact thing `./Dots.tsx` exists to
 *     refuse. Here the `<Show>`'s fallback is already the `•••`, so the button
 *     simply stays put until the panel can replace it.
 *   - a fetch that fails THROWS, out of a render, into an `ErrorBoundary` that
 *     does not exist — which takes down the row, or worse, rather than the
 *     menu. A signal read is an answer a component can draw a sentence from.
 *
 * ## When it does not arrive
 *
 * A fetch that fails is remembered ({@link menuFailure}) and said out loud — in
 * the console, and on the page by the row that asked (`./NodeMenu.tsx` draws it
 * on the same said-line every verb answers on). Like the markdown pipeline's, it
 * is deliberately not a thrown fault and there is no retry loop: the outline is
 * still readable and every verb in the menu has a keyboard or a drawer path,
 * and a loop of failing imports is a page that gets slower the longer it is
 * broken. Reloading is the honest answer, and the sentence says so.
 */

import { createSignal } from "solid-js"

import type { Dropdown } from "./Dropdown.tsx"

/**
 * Where the primitive has got to: not here, here, or not coming. ONE signal
 * holding all three, because they are one fact — two signals would be two
 * writes to keep in step, and a state that said both "failed" and "here" is a
 * state nothing should be able to spell.
 *
 * The `type` import above is the only other mention of `./Dropdown.tsx` in the
 * client and it is erased at build time, so this module's one value-carrying
 * edge to it is the `import()` below. `../claims.test.ts` holds that.
 */
const [arrival, setArrival] = createSignal<typeof Dropdown | Error | undefined>(undefined)

/** Has the fetch been started? Not a signal: nothing draws from it, and it is
 *  the one piece of this that must not re-run anything when it changes. */
let asked = false

/**
 * Is the primitive here yet — and, if it is not, start fetching it.
 *
 * Read inside `./NodeMenu.tsx`'s `<Show>`, which is what makes the answer
 * changing from `false` to `true` swap the `•••` for the open panel.
 */
export const menuReady = (): boolean => {
  const here = arrival()
  if (here === undefined && !asked) {
    asked = true
    void fetchDropdown()
  }
  return here !== undefined && !(here instanceof Error)
}

/** Why it is not coming, once that is known. Reactive, for the row that says
 *  so on the page (`./NodeMenu.tsx`). */
export const menuFailure = (): Error | undefined => {
  const here = arrival()
  return here instanceof Error ? here : undefined
}

/**
 * The primitive, for code that has already established it is here.
 *
 * Throws rather than returning `undefined`, because the one caller is a
 * `<Show>` that just read {@link menuReady}: a throw here is a bug in this
 * app's own ordering, and a menu that merely failed to draw would hide it
 * behind a row that looked like one nobody had pressed.
 */
export const dropdownNow = (): typeof Dropdown => {
  const here = arrival()
  if (here === undefined || here instanceof Error) {
    throw new Error("the ••• menu was drawn before its primitive arrived — read menuReady() first")
  }
  return here
}

const fetchDropdown = async (): Promise<void> => {
  try {
    // The literal specifier is the point: the bundler READS it, which is what
    // gets `./Dropdown.tsx`'s graph — Kobalte, `./Panel.tsx`, `./Confirm.tsx` —
    // out of `main-*.js` and into a chunk of its own rather than merely
    // unreached inside it.
    const { Dropdown: here } = await import("./Dropdown.tsx")
    // Wrapped, because what is being stored IS a function: a bare
    // `setArrival(here)` would be read as an updater and store whatever the
    // component returned when handed the previous state.
    setArrival(() => here)
  } catch (cause) {
    const error = new Error(
      `the ••• menu could not be loaded: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause },
    )
    console.error(error)
    setArrival(error)
  }
}
