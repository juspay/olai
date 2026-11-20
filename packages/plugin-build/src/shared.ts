/**
 * Where the host's own module namespaces hang — one global, in both processes.
 * A global rather than an argument: a built chunk is `import()`ed by URL in
 * the tab and by `data:` URL in the serve, and an ES module takes no
 * parameters.
 */
export const REGISTRY = "__olai_plugin_modules"

/** What a server half's imports bind to — the specifier an author writes, and
 *  the door of this binary it means. */
export const SERVER_MODULES: ReadonlyArray<string> = ["@olai/plugin-api", "effect"]

/** ...and a browser half's. `solid-js/web` is the transform's, never the
 *  author's: `./imports.ts` refuses it as an import while it is bound here. */
export const BROWSER_MODULES: ReadonlyArray<string> = [
  "@olai/plugin-api",
  "effect",
  "solid-js",
  "solid-js/web",
]

/** The three an author may write, in both halves — and what a refusal quotes
 *  back at somebody who wrote a fourth. */
export const WRITABLE_MODULES: ReadonlyArray<string> = ["@olai/plugin-api", "effect", "solid-js"]
