/**
 * When the markdown machinery arrives.
 *
 * ./pipeline.ts is a bundle of its own (~391 KB raw, ~96 KB brotli) and the
 * initial paint of an outline does not wait for it: a tree of titles,
 * checkboxes and badges is drawn out of `main-*.js` alone, and this file is
 * what fetches the rest — the first time something on the page turns out to
 * need a markdown parser, and never on a page where nothing does.
 *
 * The URL is not compiled into the bundle. The build writes
 * `/assets/markdown-<hash>.js` beside the entry and names it on the `no-store`
 * shell (a `<meta>`, read below), which is the same arrangement the entry and
 * the stylesheet already have: the shell is re-fetched every load and names
 * what is pinned immutable. It also means a rebuild that only changes the
 * markdown chunk does not change `main-*.js`'s bytes.
 *
 * ## How the rest of the app asks
 *
 * {@link markdownReady} is a SIGNAL read, so a memo that asks becomes a memo
 * that re-runs when the file lands — which is the whole of the "raw text now,
 * rendered a moment later" behaviour in ./render.ts's callers. Asking is also
 * what STARTS the fetch: nothing has to be primed at boot, and a page that
 * never draws markdown never asks. (Solid's own `lazy` works the same way, for
 * the same reason: the thing that needs it is the thing that knows.)
 *
 * ## When it does not arrive
 *
 * A fetch that fails is remembered ({@link markdownFailure}) and said out loud
 * — in the console, and on the page by whoever was waiting for it
 * (./Markdown.tsx draws the source with a line saying the renderer never
 * came). It is deliberately not a thrown fault: the text is still readable
 * markdown, and taking the page down would be replacing something a reader can
 * read with something they cannot. There is no retry loop either — a reload is
 * the honest answer, and a loop of failing imports is a page that gets slower
 * the longer it is broken.
 */

import { createSignal } from "solid-js"

import { MARKDOWN_META } from "./meta.ts"
import type { Pipeline } from "./pipeline.ts"

/**
 * Where the pipeline has got to: not here, here, or not coming. ONE signal
 * holding all three, because they are one fact — two signals would be two
 * writes to keep in step, and a state that said both "failed" and "here" is a
 * state nothing should be able to spell.
 */
const [arrival, setArrival] = createSignal<Pipeline | Error | undefined>(undefined)

/** Has the fetch been started? Not a signal: nothing draws from it, and it is
 *  the one piece of this that must not re-run anything when it changes. */
let asked = false

/**
 * Is the pipeline here yet — and, if it is not, start fetching it.
 *
 * Read inside a memo (every caller in ./render.ts's callers is), which is what
 * makes the answer change from `false` to `true` re-render the thing that
 * asked.
 */
export const markdownReady = (): boolean => {
  const here = arrival()
  if (here === undefined && !asked) {
    asked = true
    void fetchPipeline()
  }
  return here !== undefined && !(here instanceof Error)
}

/** Why it is not coming, once that is known. Reactive, for the one component
 *  that says so on the page (./Markdown.tsx). */
export const markdownFailure = (): Error | undefined => {
  const here = arrival()
  return here instanceof Error ? here : undefined
}

/**
 * The pipeline, for code that has already established it is here.
 *
 * Throws rather than returning `undefined`, because every caller
 * (./render.ts) is inside a memo that just read {@link markdownReady}: a throw
 * here is a bug in this app's own ordering, and a silent empty rendering would
 * hide it behind a page that merely looked blank.
 */
export const pipelineNow = (): Pipeline => {
  const here = arrival()
  if (here === undefined || here instanceof Error) {
    throw new Error(
      "the markdown pipeline was used before it arrived — read markdownReady() first",
    )
  }
  return here
}

/**
 * Hand the pipeline over.
 *
 * Called by the fetch below, and directly by unit tests: a test runs in Bun
 * with no shell to read a `<meta>` off, so it imports ./pipeline.ts itself and
 * installs it. That is the same module the browser ends up with, which is what
 * makes those tests tests of the thing that ships.
 */
export const installPipeline = (module: Pipeline): void => {
  setArrival(() => module)
}

const fetchPipeline = async (): Promise<void> => {
  try {
    // A variable specifier, deliberately: the bundler leaves it alone, which
    // is what keeps ./pipeline.ts's graph out of `main-*.js` instead of merely
    // unreached inside it.
    const href = chunkHref()
    installPipeline((await import(href)) as Pipeline)
  } catch (cause) {
    const error = new Error(
      `the markdown renderer could not be loaded: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause },
    )
    console.error(error)
    setArrival(error)
  }
}

/** Where the build put it. A missing `<meta>` is a build that did not rewrite
 *  the shell, so it says that rather than importing `"null"`. */
const chunkHref = (): string => {
  const named = document
    .querySelector(`meta[name="${MARKDOWN_META}"]`)
    ?.getAttribute("content")
  if (named === null || named === undefined || named === "") {
    throw new Error(
      `no <meta name="${MARKDOWN_META}"> on this page — the shell was not rewritten by the build`,
    )
  }
  return named
}
