/** Permanent process identity and runtime management. No notebook provider
 * is required to inspect the roster or change its activation selection.
 * Domain capabilities declare their own members beside their providers. */
import { OpFailure } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { App } from "./app.ts"
import { NO_ROSTER } from "./plugins.ts"
import { PluginRoster } from "./plugins.ts"
import { sameRoster } from "./plugins.ts"
import { Who } from "./who.ts"
export const surface = defineSurface({
cells: {
/**
     * WHICH PLUGINS THIS BUILD HAS, and which this SERVE runs — see
     * {@link PluginRoster}.
     *
     * A CELL for the reason the two above it are: one value about the served
     * INSTANCE rather than about any file in it. It is the sharpest case of it
     * on this spec — the flag is read once, at the composition root, so this
     * flag is read once at the composition root and nothing on that side
     * republishes it by itself.
     *
     * IT NO LONGER MOVES AT MOST ONCE, and the `equals` below is what that
     * costs. A plugin is a fiber, so the roster is republished from the
     * re-compose — every register and every dispose — and the tab MOVES on it:
     * a roster change is a `redial`, which builds a new wire and rebuilds the
     * page's whole tree under it. A republish carrying the identical value
     * must not do any of that, and it is not a rare case — a reconnect
     * republishes. {@link sameRoster} argues it in full.
     *
     * Wire-read-only, and the paragraph that used to stand here said it was
     * more than the usual: *`--plugins` is CLI/nix ONLY, so there is no verb a
     * browser could call*. There is one now — {@link plugins.set}, one group
     * down — and this cell is read-only for the ORDINARY reason instead: the
     * server is the only thing that knows what its fibers are doing, a flip is
     * an act with a refusal rather than an assignment, and what comes back from
     * pressing the switch is this cell moving. `git` is the same pairing one
     * member over, which is why the names collide on purpose.
     *
     * CORE'S OWN MEMBER, about plugins, which is not the contradiction it
     * looks like: a plugin that is off composes no surface at all, so the
     * member that would answer "am I running" is missing in exactly the case
     * the answer is interesting. {@link ./plugins.ts} argues it, and argues
     * why core still spells no plugin's name — the names are data walked out
     * of this cell.
     */
    plugins: {
      schema: PluginRoster,
      default: NO_ROSTER,
      verbs: ["get"],
      // TWO ROSTERS THAT SAY THE SAME THING ARE ONE — see the paragraph above
      // and `sameRoster`.
      equals: sameRoster,
      /** A ROW IS ITS `name`, and the fence one package over is what makes
       *  that an identity rather than a hope: no two plugins may share a name
       *  (`@olai/bundle`'s `fence.test.ts`), because the name is the sibling
       *  key every one of its tags is composed under. */
      arrayKey: "name",
    }
},
procedures: {
plugins: { set: {
        input: Schema.Struct({
          /** The plugin's `name` — the row's own word, walked out of the
           *  `plugins` cell. Never a label, never an index: {@link BuiltPlugin}
           *  argues why the name is the identity. */
          name: Schema.String,
          /** WHERE THE SWITCH IS BEING PUT, not which way to move it. A toggle
           *  that said "flip" would be two tabs racing to the state neither of
           *  them asked for. */
          enabled: Schema.Boolean,
        }),
        output: Schema.Struct({}),
        error: OpFailure,
      } },
/**
     * WHO IS LOOKING on this connection — the login a reverse proxy stamped
     * on the upgrade, already resolved down the picture ladder.
     *
     * A PROCEDURE, not a cell: a cell is one value for the process, and this
     * value is one value for THIS TAB. The login is stamped at the upgrade
     * and does not move for the life of the socket, so there is nothing to
     * subscribe to. `GET /olai/who` stays for the plain-HTTP doors (a share
     * sheet, a script); a tab that is already connected reads this instead.
     *
     * THE BROWSER'S ALONE: an agent has no login header on its face, and
     * asking who is looking at a tab is a paint instruction for a chip.
     */
    who: {
      get: {
        output: Schema.NullOr(Who),
      },
    },
/**
     * WHAT THIS DEPLOYMENT IS CALLED — the machine the server runs on, so the
     * app can name itself `olai [machine]` everywhere it names itself
     * (`./app.ts` says why, and what draws it).
     *
     * THE SAME SHAPE as `who.get` — one ask, asked once: a process constant
     * is nothing to subscribe to, so it is a procedure and not a cell. And
     * THE BROWSER'S ALONE, also for `who.get`'s reason: an agent acts on the
     * vault, not on the chrome; the box's name is a paint instruction the
     * manifest, the wordmark and the tab draw.
     */
    app: {
      get: {
        output: App,
      },
    }
}
})
