/**
 * ODU'S BROWSER HALF — a plugin, exactly the shape its server half is.
 *
 * ## What this replaced
 *
 * `./plugin.ts`: a manifest object with `dressings`, `mount` and `mark` on it,
 * listed in a compiled-in registry and walked by three modules inside
 * `@olai/web`. The object is gone and so is the registry that carried it; what
 * it DECLARED, this REGISTERS.
 *
 * The difference that matters is not the shape. A manifest is present whether
 * or not the serve composed this plugin, so every walk over it carried a
 * licence beside it — and the two licences pointed opposite ways, because a
 * face drawn early and taken away is a flicker while a subscription opened
 * early LATCHES a degraded readout for the life of the page. This module is
 * evaluated only when the roster names odu: its chunk is fetched then and not
 * before, its fiber is mounted then, and every registration below unwinds by
 * itself if the roster stops naming it. There is nothing left to license.
 *
 * ## `surface` rides this chunk, and that is why there is one chunk
 *
 * The tab has to DIAL this sibling before any face below can read a thing, and
 * the spec is what it dials by. So the wire half travels with the browser half:
 * what the roster names, the tab fetches once and both mounts and dials.
 *
 * ## The graph is unchanged and the reasoning is not
 *
 * This module reaches `./browser/`, and therefore SolidJS; `./wire.ts` is a
 * schema and a name and could be read by a daemon; `./server.ts` reaches
 * `@olai/odu-client`. Three entries because three graphs, exactly as before —
 * what changed is that the door onto this one is a dynamic `import()` in a
 * generated row rather than a static import in a hand-written registry, so
 * nothing pulls this graph until a serve says it is running.
 */

// THE APP'S DOOR — the tags this half names and the `definePlugin` that turns
// an Effect into a plugin (`@olai/plugin-api`'s `browser.ts`). Its server half
// opens exactly the one door over, and neither of them names `cordis`.
import { Clocks, definePlugin, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import type { Accessor } from "solid-js"

import type { CiRuns } from "olai-plugin-odu/appliance/wire"

import { CiChip } from "./browser/CiChip.tsx"
import { ClocksProvider } from "./browser/clocks.tsx"
import { OduMark } from "./browser/Mark.tsx"
import { RunsProvider } from "./browser/runs.tsx"
import { RunMatrix } from "./browser/RunMatrix.tsx"
import { WORKTREE_KIND } from "./kinds.ts"

import { name, surface } from "./wire.ts"

export { name, surface }

/**
 * THE MEMBER this plugin's browser half reads, structurally.
 *
 * One cell, which is a whole surface — `./wire.ts` argues why a run is a
 * reading of somebody else's work and there is nothing a browser can write
 * back. Spelled at the depth the sibling client presents it (`cells.ci`, not
 * `cells.odu.ci`: the key is consumed by the scope), so `ctx.wired` hands this
 * plugin's client across with no adapter. A member renamed in `./wire.ts` is a
 * type error in this package rather than a chip that quietly never fills.
 */
interface CiClient {
  readonly cells: {
    readonly ci: {
      use: () => { readonly value: Accessor<CiRuns | undefined> }
    }
  }
}

/**
 * WHAT THIS PLUGIN NEEDS OF THE APP, named rather than handed.
 *
 * `slots` is where every face below hangs. `clocks` is the app's own duration
 * ladder — the chip TICKS, and a reader who has learnt what a ticking number
 * looks like in olai should not have to learn it again because the thing
 * ticking is a test suite. `Wired` is this plugin's own sibling client, minted
 * from its own word so it cannot be asked for under another plugin's name.
 *
 * No `bar` and no `links`: nothing odu draws is in the app's chrome and nothing
 * it draws is a door onto a file, so it asks for neither — which is the same
 * honest narrowness the `OduApp` re-declaration had, said to the runtime AND to
 * the type checker: `needs` is what the runtime holds this plugin `waiting`
 * against, and it is the same list the compiler computes this Effect's
 * requirements from.
 */
export default definePlugin({
  name,
  needs: [Slots, Clocks, Wired],
  apply: Effect.gen(function*() {
    const clocks = yield* Clocks
    const slots = yield* Slots
    const wired = yield* Wired

    // THE CHIP AND WHAT ITS PRESS OPENS — this plugin's one dressing.
    //
    // A `worktree` is a path on a row and is worth exactly nothing until
    // something is happening in it, so its face is an ADDITION to the line that
    // appears only while there is a run — where the terminal door one appliance
    // over owns a row always. The matrix is a grid and a chip is an inline box in
    // a wrapping line, so what the press opens hangs under the run as the pane
    // rather than inside the chip.
    //
    // THE WORD IS THIS PLUGIN'S KIND and is passed BARE: the slot table composes
    // it with this plugin's own name, exactly as `Kinds` composes it on the
    // server, so the word a face is looked up by and the word a vault declares
    // cannot be two spellings. It is the same constant the probe walk follows and
    // the value gate holds a declaration to — one spelling, one authority, and
    // the chip and the dial cannot come apart.
    yield* slots.register("outline.row.chip", WORKTREE_KIND, CiChip)
    yield* slots.register("outline.row.pane", WORKTREE_KIND, RunMatrix)
    // ODU'S FACE IN A TRANSCRIPT — the mark over a sentence the doorbell
    // delivered into somebody's conversation. It is contributed from the tenant
    // that owns it because core may know this plugin's NAME as data and nothing
    // else; the panel looks it up by the word it already stamped on the row.
    yield* slots.register("chat.speaker.mark", OduMark)
    // THE TAB'S CI HALF — one subscription however many chips draw. An outline
    // can carry a `worktree` on a dozen rows and every one of them wants to know
    // whether its checkout is mid-run, so the subscription is here, once per tab,
    // and a chip reads a context instead.
    yield* slots.register("app.mount", (props) => (
      // INSIDE the component and not at apply time: `use()` opens a subscription
      // and wants an owner, and the owner is the one this component is created
      // under. The one narrowing is here too, at the one edge — a cast rather
      // than a guard because there is nothing to check: the value came from the
      // framework's own client bundle under this plugin's key.
      <ClocksProvider clocks={clocks}>
        <RunsProvider runs={(wired.client() as CiClient).cells.ci.use().value}>
          {props.children}
        </RunsProvider>
      </ClocksProvider>
    ))
  }),
})
