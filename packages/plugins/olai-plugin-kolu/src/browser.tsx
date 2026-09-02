/**
 * KOLU'S BROWSER HALF — a Cordis plugin, exactly the shape its server half is.
 *
 * `./plugin.ts` was a manifest object with `dressings`, `chrome`, `mount` and
 * `mark` on it, listed in a compiled-in registry and walked by four modules
 * inside `@olai/web`. The object is gone with the registry that carried it;
 * what it DECLARED, this REGISTERS. `olai-plugin-odu/browser` argues the move
 * in full — the short of it is that a manifest is present whether or not the
 * serve composed the plugin, so every walk over it needed a licence beside it,
 * and a fiber the roster never named needs none.
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

// THE AUGMENTATION, and nothing else: a type-only import puts no runtime on
// this chunk and is what types `ctx.slots` and the three services beside it
// (`@olai/plugin-api`'s `browser.ts`). Its server half does exactly this one
// door over.
import type {} from "@olai/plugin-api"
import type { Context } from "cordis"

import { KoluUi, TerminalBlock } from "./appliance/index.ts"
import type { KoluClient } from "./appliance/index.ts"
import type { KoluApp } from "./browser/app.ts"
import { KoluMark } from "./browser/Mark.tsx"
import { Padi } from "./browser/Padi.tsx"
import { TERMINAL_KIND } from "./kinds.ts"

export { name, surface } from "./wire.ts"

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
export const inject = ["slots", "bar", "clocks", "links", "wired"] as const

export function apply(ctx: Context): void {
  // WHAT THIS PLUGIN READS OF THE APP, composed once out of the services it
  // named. The faces below still take it as a prop, because `./browser/app.ts`
  // is this package's own structural declaration of exactly what it spends and
  // it stays exactly as narrow as it was — a field asked for there that the app
  // does not hand over is a type error on this line, with this plugin's name on
  // the file. What changed is that the app no longer hands one blob to every
  // face: this half NAMES what it wants, and Cordis holds its fiber `PENDING`
  // until every one of them exists.
  const app: KoluApp = {
    desktop: () => ctx.bar.desktop(),
    pill: ctx.bar.pill,
    createPopover: () => ctx.bar.popover(),
    FileLink: ctx.links.File,
  }
  // THE TERMINAL DOOR — a BLOCK, because a terminal owns its row whether or not
  // anything is happening in it, where odu's chip appears only while there is a
  // run. The word is passed BARE and `ctx.slots` composes it with the fiber's
  // name, exactly as `ctx.kinds` composes it on the server, so the word a face
  // is looked up by and the word a vault declares cannot be two spellings.
  ctx.slots.register("outline.row.block", TERMINAL_KIND, TerminalBlock)
  // THE PADI PILL, in the app's chrome row. Where it sits in the cluster is the
  // app's decision and always was; what a plugin gets is a seat.
  ctx.slots.register("app.header", () => <Padi app={app} />)
  // KOLU'S FACE IN A TRANSCRIPT — the mark over a sentence its doorbell
  // delivered into somebody's conversation.
  ctx.slots.register("chat.speaker.mark", KoluMark)
  // THE TAB'S KOLU HALF — one subscription however many rows draw. `KoluUi`
  // binds the three cells, the two collections, the screen read and the pane's
  // un-enrolled stream, and its own header argues each.
  //
  // THE CADENCE IS THIS PACKAGE'S JUDGEMENT and not the appliance's: the Dock's
  // recency phrase ticks by the MINUTE in olai and by the SECOND in kolu's own
  // dock, because an outline can carry forty lanes with a terminal each and a
  // per-second tick per row is a re-render storm bought for a digit nobody is
  // watching in a document somebody is reading. What stays the app's is the
  // LADDER and the LIFETIME — `ctx.clocks` owns the units and hands back a
  // timer that disposes with its component.
  ctx.slots.register("app.mount", (props) => (
    <KoluUi
      client={ctx.wired.client() as KoluClient}
      now={ctx.clocks.createTicking(ctx.clocks.MINUTE)}
    >
      {props.children}
    </KoluUi>
  ))
}
