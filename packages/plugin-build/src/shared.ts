/**
 * THE THREE MODULES A DYNAMIC PLUGIN MAY NAME, and how it reaches them.
 *
 * ## The ruling, and the thing it rules out
 *
 * *An agent-written plugin is ordinary plugin source and imports
 * `@olai/plugin-api`, `effect` and `solid-js` by their bare names; olai resolves
 * them itself, and any other bare import is refused with a sentence naming it — a
 * vault has no `node_modules` and never will* (the human, 2026-09-05).
 *
 * So the three names are not a dependency list, they are a VOCABULARY: the
 * source is never resolved against a disk, and there is nothing on the machine
 * for `import "left-pad"` to find. What is on the machine is the running
 * binary's own copy of those three, already loaded, and the whole of this module
 * is how a module built at runtime reaches THAT copy rather than a second one.
 *
 * ## Why it has to be the same copy, and why that is not fussiness
 *
 * A second Solid is a second reactive runtime: a face drawn by it sits inside
 * the app's tree, reads a context the app's copy owns, and finds nothing —
 * which is exactly the `an agents lookup outside <AgentsProvider>` failure
 * `@olai/web`'s plugin runtime records from the other side. A second Effect is a
 * second set of service tags, so `yield* Slots` in a dynamic plugin would resolve
 * against a table nobody provided. A second `@olai/plugin-api` is both at once.
 *
 * Bundling them into the chunk gives exactly that second copy. Marking them
 * EXTERNAL leaves `import { createSignal } from "solid-js"` in the output, and a
 * browser resolving that specifier over HTTP finds nothing at all. Neither
 * arrangement can work, so the specifier is not resolved: it is BOUND, to a
 * table the host puts on `globalThis` out of its own static imports
 * ({@link REGISTRY}). One copy, by construction, and the binding is a
 * destructure rather than a lookup at each use.
 *
 * ## The name is per HALF, and one bare word means two modules
 *
 * `@olai/plugin-api` is one package with several doors: a server half opens
 * `./services` and a browser half opens the root, which is where the slots, the
 * app's furniture and `definePlugin`'s browser spelling live. A plugin written by
 * an agent writes the bare name in both files and olai points it at the right
 * door — which is the whole of what "olai resolves them itself" buys, and the
 * reason the two lists below differ rather than one list being a subset.
 *
 * `solid-js/web` is on the browser list and is NOT a name an agent may write: it
 * is what the Solid transform EMITS (`template`, `insert`, `createComponent`),
 * so it has to be bound, and it is refused as an import for the same reason
 * every other specifier is — see `./imports.ts`.
 */

/**
 * WHERE THE HOST'S OWN MODULES HANG — one global, in both processes.
 *
 * A global rather than an argument, because the thing being reached is reached
 * from inside a module the host did not write and cannot pass anything to: the
 * chunk is `import()`ed by URL in the tab and by `data:` URL in the serve, and
 * an ES module takes no parameters. `globalThis` is the one table both ends can
 * name.
 *
 * NOT A SERVICE and not a door: what it holds is three module namespaces, which
 * every page in the process already has statically. There is nothing here a
 * plugin could not have imported if it had been compiled with the app.
 */
export const REGISTRY = "__olai_plugin_modules"

/** What a SERVER half's imports bind to — the specifier an agent writes, and
 *  the door of this binary it means. `effect` is the whole package: a plugin's
 *  `apply` IS an Effect, so `Effect`, `Layer`, `Schema` and the rest are one
 *  namespace and there is nothing to narrow. */
export const SERVER_MODULES: ReadonlyArray<string> = ["@olai/plugin-api", "effect"]

/** ...and a BROWSER half's. `solid-js/web` is the transform's, never the
 *  author's ({@link ./imports.ts} refuses it as an import while binding it
 *  here). */
export const BROWSER_MODULES: ReadonlyArray<string> = [
  "@olai/plugin-api",
  "effect",
  "solid-js",
  "solid-js/web",
]

/** THE THREE AN AUTHOR MAY WRITE, in both halves — the vocabulary the ruling
 *  names, and what a refusal quotes back at somebody who wrote a fourth. */
export const WRITABLE_MODULES: ReadonlyArray<string> = ["@olai/plugin-api", "effect", "solid-js"]
