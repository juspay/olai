/**
 * When the markdown machinery arrives.
 *
 * ./pipeline.ts is a chunk of its own (~390 KB raw, ~95 KB brotli) and the
 * initial paint of an outline does not wait for it: a tree of titles,
 * checkboxes and badges is drawn out of `main-*.js` alone, and this file is
 * what RUNS the rest — the first time something on the page turns out to need
 * a markdown parser, and never on a page where nothing does.
 *
 * THE FETCH IS THE SHELL'S, and that is a 2026-08-24 reversal worth reading
 * before this file's own story: `index.html` carries a
 * `<link rel="modulepreload">` for the chunk, so the bytes are on their way off
 * the same head as the entry — behind it and the stylesheet, which is what a
 * FIRST paint waits on — whatever the page turns out to draw. What that buys is the WAIT — a page of markdown used to
 * hold the file's own source for a whole round trip after the entry ran, which
 * is the flash `../styles.css` now blurs and this tag now shortens. What it
 * costs is the bytes on a page that draws no markdown at all, which the human
 * ruled worth it (roadmap `markdown-raw-flash`). The split is untouched: the
 * chunk is still its own immutable file rather than 95 KB inside `main-*.js`,
 * and the `import()` below is still the only thing that RUNS it.
 *
 * The `import()` below is the WHOLE of the split. `buildSurfaceClient` splits
 * on a dynamic import and names chunks with the same `[hash]` the entry gets
 * (kolu#2159), so the pipeline lands in the same immutable `/_olai/assets/` dir and
 * the entry references it by a URL that resolves inside it. Nothing here has to
 * know that URL, and nothing has to write it anywhere: this file used to read a
 * `<meta>` off the shell because the helper hardcoded `splitting: false` and
 * olai therefore ran a second `Bun.build` and rewrote the shell itself — three
 * moving parts (a build, a placeholder, a reader) held together to say what one
 * `import()` says on its own.
 *
 * WHAT A CHUNK'S ARRIVAL IS — the one signal over not-here / here / not-coming,
 * the read that starts the fetch, the failure kept as a value — is
 * `../arriving.ts`, since the `•••` menu's primitive is fetched the same way
 * (`../menu/chunk.ts`). What stays here is this app's four names for it, and
 * the literal specifier, which has to be written where the bundler will read
 * it.
 *
 * ## How the rest of the app asks
 *
 * {@link markdownReady} is a SIGNAL read, so a memo that asks becomes a memo
 * that re-runs when the file lands — which is the whole of the "the source,
 * illegible, until the renderer lands" behaviour in ./render.ts's callers
 * (./Markdown.tsx, ./title.ts, and the one rule in ../styles.css they share).
 * Asking is also what starts the `import()`: nothing is primed at boot, and a
 * page that never draws markdown never runs the parser. (Solid's own `lazy`
 * works the same way, for the same reason: the thing that needs it is the
 * thing that knows.) What it no longer starts on a warm document is the FETCH
 * — the shell asked for those bytes before this module existed on the page —
 * which is why the wait between a first paint and a rendering is now about a
 * frame rather than a round trip.
 *
 * ## When it does not arrive
 *
 * A fetch that fails is remembered ({@link markdownFailure}) and said out loud
 * — in the console, and on the page by whoever was waiting for it
 * (./Markdown.tsx draws the source with a line saying the renderer never
 * came, and unblurred: at that point the source IS the answer, and a reader
 * has to be able to read it). It is deliberately not a thrown fault: the text
 * is still readable markdown, and taking the page down would be replacing
 * something a reader can read with something they cannot. There is no retry
 * loop either — a reload is the honest answer, and a loop of failing imports
 * is a page that gets slower the longer it is broken.
 */

import { createArrival } from "../arriving.ts"

// The literal specifier is the point: the bundler READS it, which is what gets
// ./pipeline.ts's graph out of `main-*.js` and into a chunk of its own rather
// than merely unreached inside it. It was a variable while `splitting` was off,
// when a specifier the bundler could resolve would have been inlined — the
// opposite of what this file is for. It also carried an `as Pipeline`, which a
// variable specifier needs and this one does not: the namespace object is
// TYPED here, so renaming an export in ./pipeline.ts is a compile error rather
// than a page that loads and then cannot render.
const pipeline = createArrival("the markdown renderer", () => import("./pipeline.ts"))

/**
 * Is the pipeline here yet — and, if it is not, start fetching it.
 *
 * Read inside a memo (every caller in ./render.ts's callers is), which is what
 * makes the answer change from `false` to `true` re-render the thing that
 * asked.
 */
export const markdownReady = pipeline.ready

/**
 * Is it still coming — not here, and not known to be lost.
 *
 * The one a SURFACE asks before it dresses itself as unfinished
 * (`data-markdown="waiting"`, ./waiting.ts): "not ready" is two situations,
 * and only one of them is going to change. A title that read `!markdownReady()`
 * instead would stay blurred forever on a page whose renderer never came —
 * which is the one case where the source a surface is holding IS the answer
 * and has to be legible.
 */
export const markdownWaiting = pipeline.waiting

/** Why it is not coming, once that is known. Reactive, for the one component
 *  that says so on the page (./Markdown.tsx). */
export const markdownFailure = pipeline.failure

/** The pipeline, for code that has already established it is here
 *  (./render.ts, inside a memo that just read {@link markdownReady}). */
export const pipelineNow = pipeline.now

/**
 * Hand the pipeline over.
 *
 * For unit tests: a test has no bundler splitting anything, so it imports
 * ./pipeline.ts itself and installs it. That is the same module the browser
 * ends up with, which is what makes those tests tests of the thing that ships.
 */
export const installPipeline = pipeline.install
