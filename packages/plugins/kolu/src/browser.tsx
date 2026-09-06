import { createRoot } from "solid-js"
import type {} from "olai-plugin-chat/slots"
import type {} from "olai-plugin-layout/slots"
import type {} from "olai-plugin-outlines/slots"
/**
 * KOLU'S BROWSER HALF — a plugin, exactly the shape its server half is.
 *
 * `./plugin.ts` was a manifest object with `dressings`, `chrome`, `mount` and
 * `mark` on it, listed in a compiled-in registry and walked by four modules
 * inside `@olai/web`. The object is gone with the registry that carried it;
 * what it DECLARED, this REGISTERS. `olai-plugin-odu/browser` argues the move
 * in full — the short of it is that a manifest is present whether or not the
 * serve composed the plugin, so every walk over it needed a licence beside it,
 * and a plugin the roster never named needs none.
 *
 * ## The chunk, and what is behind it
 *
 * This module reaches `./appliance/` and `./browser/`, and therefore SolidJS
 * and a terminal emulator. That was the heaviest graph in the tree and the
 * reason the manifests needed a door of their own; it is a SPLIT CHUNK now,
 * named by a literal `import()` in a generated row and fetched only when a
 * serve says kolu is running. A machine that does not run kolu no longer
 * downloads a terminal emulator to draw nothing with it.
 *
 * `surface` rides this chunk because the tab has to DIAL the sibling before any
 * face below can read anything: what the roster names, the tab fetches once and
 * both mounts and dials.
 */

// THE APP'S DOOR — the tags this half names and the `definePlugin` that turns
// an Effect into a plugin (`@olai/plugin-api`'s `browser.ts`). Its server half
// opens exactly the one door over, and neither of them names `cordis`.
import { Bar, Clocks, definePlugin, Links, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"

import { KoluUi, createKoluUi, TerminalBlock } from "./appliance/index.ts"
import type { KoluClient } from "./appliance/index.ts"
import type { KoluApp } from "./browser/app.ts"
import { KoluMark } from "./browser/Mark.tsx"
import { Padi } from "./browser/Padi.tsx"
import { TERMINAL_KIND } from "./kinds.ts"

export { name, surface } from "./wire.ts"
import { name } from "./wire.ts"

/**
 * ALL FOUR, because kolu spends all four: `slots` is where its faces hang,
 * `bar` carries the padi pill's geometry and the panel that hangs off it,
 * `clocks` is the ladder its recency phrase ticks on, and `wired` is its own
 * sibling client.
 *
 * `links` is the fifth and it is spent in one place: the padi feed names the
 * file a lane was scoped to, and a link into the served set is the app's router
 * and its address grammar — two of the app's names to make one link, handed
 * over as one so this package holds neither.
 */
export default definePlugin({
  name,
  needs: [Slots, Bar, Clocks, Links, Wired],
  apply: Effect.gen(function*() {
    const bar = yield* Bar
    const clocks = yield* Clocks
    const links = yield* Links
    const slots = yield* Slots
    const wired = yield* Wired

    // WHAT THIS PLUGIN READS OF THE APP, composed once out of the services it
    // named. The faces below still take it as a prop, because `./browser/app.ts`
    // is this package's own structural declaration of exactly what it spends and
    // it stays exactly as narrow as it was — a field asked for there that the app
    // does not hand over is a type error on this line, with this plugin's name on
    // the file. What changed is that the app no longer hands one blob to every
    // face: this half NAMES what it wants, the compiler computes this Effect's
    // requirements from the same list, and the runtime holds it `waiting` until
    // every one of them exists.
    //
    // THE THREE FUNCTIONS ARE HELD RATHER THAN WRAPPED, which they could not be
    // while these were service classes: a prototype method detached from its
    // receiver threw deep inside a render, so every call site had to re-wrap one.
    // A tag's shape is the record, so holding one is exactly what it was when the
    // app handed a record over (`@olai/plugin-api`'s `browser.test.ts`).
    const owned = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => ({dispose, value: createKoluUi({client:wired.client() as KoluClient, now:clocks.createTicking(clocks.MINUTE)})}))), owned => Effect.sync(owned.dispose))
    const app: KoluApp = {
      desktop: bar.desktop,
      pill: bar.pill,
      popover: bar.popover,
      FileLink: links.File,
    }
    // THE TERMINAL DOOR — a BLOCK, because a terminal owns its row whether or not
    // anything is happening in it, where odu's chip appears only while there is a
    // run. The word is passed BARE and the slot table composes it with this
    // plugin's own name, exactly as `Kinds` composes it on the server, so the
    // word a face is looked up by and the word a vault declares cannot be two
    // spellings.
    yield* slots.register("outline.row.block", TERMINAL_KIND, props => <KoluUi value={owned.value}><TerminalBlock {...props} /></KoluUi>)
    // THE PADI PILL, in the app's chrome row. Where it sits in the cluster is the
    // app's decision and always was; what a plugin gets is a seat.
    yield* slots.register("app.header", { place: "cluster", body: () => <KoluUi value={owned.value}><Padi app={app} /></KoluUi> })
    // KOLU'S FACE IN A TRANSCRIPT — the mark over a sentence its doorbell
    // delivered into somebody's conversation.
    yield* slots.register("delivery.mark", KoluMark)

  }),
})
