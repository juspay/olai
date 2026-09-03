/**
 * XYNE SPACES' BROWSER HALF — a Cordis plugin, exactly the shape its server
 * half is.
 *
 * `./plugin.ts` was a manifest object with `chrome`, `mount` and `mark` on it,
 * listed in a compiled-in registry and walked by three modules inside
 * `@olai/web`. The object is gone with the registry that carried it; what it
 * DECLARED, this REGISTERS. `olai-plugin-odu/browser` argues the move in full —
 * the short of it is that a manifest is present whether or not the serve
 * composed the plugin, so every walk over it needed a licence, and a fiber the
 * roster never named needs none.
 *
 * THIS ROW IS OPT-IN (`disabled: true` in `olai.yml`), which used to mean the
 * tab loaded this module and drew nothing out of it. It means the chunk is
 * never fetched now: the roster is what asks for one.
 */

// THE AUGMENTATION, and nothing else: a type-only import puts no runtime on
// this chunk and is what types `ctx.slots` and the three services beside it
// (`@olai/plugin-api`'s `browser.ts`). Its server half does exactly this one
// door over.
import type {} from "@olai/plugin-api"
import type { Context } from "cordis"
import type { Accessor } from "solid-js"

import type { SpacesApp } from "./browser/app.ts"
import type { SpacesLink } from "./wire.ts"
import { LinkProvider } from "./browser/link.tsx"
import { SpacesMark } from "./browser/Mark.tsx"
import { Spaces } from "./browser/Spaces.tsx"

export { name, surface } from "./wire.ts"

/**
 * THE MEMBER this plugin's browser half reads, structurally.
 *
 * `ctx.wired.client()` is `unknown` for the reason a server half's `dial` is:
 * core cannot type a plugin's own client without learning its members. So the
 * narrowing happens here, against a declaration of exactly the one member this
 * half reads — `olai-plugin-odu`'s `CiClient` pin one appliance over — and a
 * member renamed in `./wire.ts` is a type error in this package rather than a
 * pill that quietly never fills. Spelled at the depth the sibling client
 * presents it (`cells.link`, not `cells.xyne-spaces.link`: the key is consumed
 * by the scope).
 */
interface LinkClient {
  readonly cells: {
    readonly link: {
      use: () => { readonly value: Accessor<SpacesLink | undefined> }
    }
  }
}

/** THE BAR, and this plugin's own client. No `clocks`: nothing spaces draws
 *  ticks. No `links`: nothing it draws is a door onto a served file. */
export const inject = ["slots", "bar", "wired"] as const

export function apply(ctx: Context): () => void {
  // THE PILL, and no drawer under it: a readout that opened nothing would be a
  // control that lied, and what this one says fits in the pill.
  //
  // The face still takes the app's furniture as a prop, because that is this
  // package's own structural declaration of what it reads
  // (`./browser/app.ts`) and it stays exactly as narrow as it was. What
  // changed is where the value comes from: the app used to hand one blob to
  // every face, and this plugin now NAMES the two services it wants and
  // composes its own reading of them here, once.
  const app: SpacesApp = { desktop: () => ctx.bar.desktop(), pill: ctx.bar.pill }
  ctx.slots.register("app.header", () => <Spaces app={app} />)
  ctx.slots.register("chat.speaker.mark", SpacesMark)
  ctx.slots.register("app.mount", (props) => (
    // INSIDE the component: `use()` opens a subscription and wants an owner.
    // The cast is the one narrowing at the one edge — the value came from the
    // framework's own client bundle under this plugin's key, so the only thing
    // a runtime test could catch is a composition built wrong, which is a
    // boot-time throw upstream rather than a branch to draw a face for.
    <LinkProvider link={(ctx.wired.client() as LinkClient).cells.link.use().value}>
      {props.children}
    </LinkProvider>
  ))
  // THE TEARDOWN THIS PLUGIN OWNS BEYOND ITS REGISTRATIONS — the same hook its
  // server half returns, and the reason this `apply` has a return type at all.
  // Every `ctx.slots.register` above unwinds by itself; anything else this
  // half starts has to be stopped here.
  return () => {}
}
