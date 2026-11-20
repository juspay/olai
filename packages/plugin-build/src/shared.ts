/** Where the host's own module namespaces hang — one global, in both processes. */
export const REGISTRY = "__olai_plugin_modules"

/** What a server half's imports bind to. */
export const SERVER_MODULES: ReadonlyArray<string> = ["@olai/plugin-api", "effect"]

/** ...and a browser half's. `solid-js/web` is the transform's own import,
 *  which `./imports.ts` refuses from an author and this binds. */
export const BROWSER_MODULES: ReadonlyArray<string> = [
  "@olai/plugin-api",
  "effect",
  "solid-js",
  "solid-js/web",
]

/** The three an author may write, in both halves. */
export const WRITABLE_MODULES: ReadonlyArray<string> = ["@olai/plugin-api", "effect", "solid-js"]
