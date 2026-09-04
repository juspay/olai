/**
 * THIS APP'S OWN MODULES, put where a plugin the SERVE compiled can reach them.
 *
 * ## What this is for
 *
 * A plugin the vault defines has its browser half compiled by the serve, out of
 * a note somebody wrote, and fetched by this tab as a module over HTTP
 * (`../wire.ts`'s `chunkAt`). Its three imports were rewritten before it got
 * here — `import { createSignal } from "solid-js"` is a read of the table below
 * — and the whole reason for that rewrite is that a SECOND Solid would be a
 * second reactive runtime: a face drawn by it sits inside this app's tree, reads
 * a context this app's copy owns, and finds nothing.
 *
 * There is an exact record of what that failure looks like one module over
 * (`./runtime.ts`'s `composing`): chat's `AgentsProvider` leaving the table one
 * finalizer before its readers, a sidebar section built outside the provider it
 * had just been deprived of, `an agents lookup outside <AgentsProvider>`, and
 * the fault boundary swallowing the app. Two copies of Solid is that, on every
 * face an agent writes, permanently.
 *
 * ## Why a global, and why it is not a leak
 *
 * The thing reaching for it is a module this app did not write and cannot pass
 * anything to: an ES module takes no parameters, and the chunk is reached by
 * URL. `globalThis` is the one table both ends can name.
 *
 * What it holds is three module namespaces every page in this bundle already
 * has statically. There is nothing here a plugin could not have imported if it
 * had been compiled with the app — which is the point: a plugin the serve
 * compiled and one the build compiled are meant to be the same kind of thing,
 * and this is what makes that true rather than nearly true.
 *
 * `solid-js/web` is in the table and is not a name an author may write
 * (`@olai/plugin-build`'s `imports.ts` refuses it): it is what the Solid
 * transform emits, so it has to be bound and must not be reachable.
 *
 * ## Written by the ENTRY, before anything mounts
 *
 * `./main.tsx` imports this module for its side effect, above its first render.
 * A chunk cannot arrive before then — it is fetched off a roster frame, which
 * arrives on a wire the entry dialled — so there is no window in which a half
 * could read an empty table.
 */

import { REGISTRY } from "@olai/plugin-build/shared"
import * as api from "@olai/plugin-api"
import * as effect from "effect"
import * as solid from "solid-js"
import * as solidWeb from "solid-js/web"

;(globalThis as Record<string, unknown>)[REGISTRY] = {
  // The BROWSER door of the plugin interface — the slots, the app's furniture
  // and `definePlugin`'s browser spelling. Its server half's bare
  // `@olai/plugin-api` is bound to `./services` one process over, which is the
  // whole of what "olai resolves them itself" means: one name in the source,
  // and each half gets the door it is written against.
  "@olai/plugin-api": api,
  effect,
  "solid-js": solid,
  "solid-js/web": solidWeb,
}
