/**
 * What `bun test` is missing to IMPORT the client — and to RUN it.
 *
 * The client's modules are written for a browser, and the unit tests import
 * them in Node anyway — deliberately, because the rules they hold (the undo
 * stack's ordering, a menu's verbs, when the fold memory asks where its ids
 * live) must not be checkable only by pressing a key in a browser.
 *
 * ## A `location`
 *
 * Importing them drags in `wire.ts`, whose one connect derives its dial URL
 * from `location.origin` at connect time (juspay/kolu#2165) and fails LOUD when
 * there is no `location` — the right answer for a real Node caller, which
 * should say the URL it means, and the wrong one for a test that only wanted
 * `applying`'s two moods and got a dead import for it.
 *
 * So the tests get the one global the wire reads, pointing into the reserved
 * `.invalid` TLD: the dial fails, as it always did here — before #2165 the url
 * thunk threw on `location` at dial time — on the socket's own retry fiber,
 * out of every test's way. Nothing else in this tree branches on `location`
 * existing; a real browser (the e2e suite) never loads this file.
 *
 * ## ...and solid's BROWSER build
 *
 * `solid-js` ships two, and its export map hands Node the SSR one — which is a
 * different library wearing the same names. `createEffect` is a **no-op**
 * there, `createResource` throws outside a hydration context, and `isServer` is
 * `true`, which is what `@solid-primitives/scheduled`'s `debounce` reads to
 * turn itself into a function that does nothing. So a unit test of anything
 * reactive does not fail under it: it PASSES, having run none of the code it
 * names. That is the worst shape a test can have, and it is one import
 * condition away from every client test anybody writes here.
 *
 * So the two entry points are pinned to the browser dist for the test runner,
 * and only for it (`bun test`'s preload; the client's own build resolves the
 * browser condition on its own). It is narrow on purpose — two paths, by exact
 * name — because the same flag applied globally (`--conditions=browser`) would
 * also swap the builds of every server-side dependency the other packages'
 * tests are about.
 */

import { plugin } from "bun"

if (typeof globalThis.location === "undefined") {
  // A `URL` has every property the wire reads (`origin`); the cast says this
  // is a stand-in for tests, not a `Location`.
  globalThis.location = new URL("http://olai.invalid") as unknown as Location
}

/** The two SSR entry points, and the browser file that stands in for each.
 *  Matched on the tail of a resolved path, because the package is installed
 *  under the isolated linker's own directory (`bunfig.toml`) and nothing here
 *  should care where that is. */
const INSTEAD: Record<string, string> = {
  "solid-js/dist/server.js": "solid-js/dist/solid.js",
  "solid-js/web/dist/server.js": "solid-js/web/dist/web.js",
}

plugin({
  name: "solid-js, the browser build",
  setup(build) {
    // ON LOAD rather than on resolve, which is not a choice: a runtime plugin's
    // `onResolve` is never consulted for a bare specifier out of node_modules,
    // so the swap has to happen to the file the resolver already picked.
    build.onLoad({ filter: /solid-js\/(web\/)?dist\/server\.js$/ }, async (asked) => {
      const ssr = Object.keys(INSTEAD).find((tail) => asked.path.endsWith(tail))
      if (ssr === undefined) return undefined
      return {
        contents: await Bun.file(asked.path.replace(ssr, INSTEAD[ssr]!)).text(),
        loader: "js",
      }
    })
  },
})
