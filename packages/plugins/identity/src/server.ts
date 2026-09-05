/**
 * IDENTITY'S SERVER HALF — the reading, as a row.
 *
 * Two lines of work and no state: read the operator's `OLAI_IDENTITY_*`
 * family once, and stand behind the `Identity` door with the names it
 * trusts and the reading over them. Core does the rest — the listener
 * names those headers on the upgrade and answers `who.get` per connection
 * from them, `GET /olai/who` reads a request's own, and `/mcp` attributes
 * a write to whoever the proxy in front said made it.
 *
 * ## No sibling surface, and no cell
 *
 * `./index.ts` argues it: the value is one value per CONNECTION, and a
 * connection is core's. There is nothing here to publish and nothing to
 * subscribe to.
 *
 * ## What a serve without this row is
 *
 * Every request is nobody. That is not a new state — it is exactly what a
 * loopback `just run` with no proxy in front already is, which is why the
 * absence needs no vocabulary of its own: `who.get` answers `null`, a
 * capture records no `captured-by`, and the chip is not drawn at all
 * because its plugin is not mounted.
 *
 * AND THE ROW IS THE SAME ROW WHENEVER IT ARRIVES. The header allowlist
 * used to be the one seam — the socket fixed it at the bind, so a row
 * switched on at the panel named its headers at the next start — and
 * juspay/kolu#2229 closed it: core asks this door for the names at each
 * accept, so the tab that redials when this row mounts is upgraded with
 * them. Nothing in this file moved for that, which is the point: what a
 * row offers did not change, only how often core reads it.
 *
 * ## The environment is read at APPLY, once
 *
 * So what a process was STARTED with is what it serves, and a flip off and
 * back on re-reads it — which is the same answer on any real serve, since
 * nothing edits a live process's environment. Reading it per request would
 * put the parse of five variables on every socket for a value that cannot
 * move.
 */

import { definePlugin, Env, Identity, Offers } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { headerNamesOf, identityConfig, whoOf } from "./who/index.ts"

export { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [Env, Offers],
  apply: Effect.gen(function*() {
    const env = yield* Env
    const offers = yield* Offers
    const config = identityConfig(env.vars)
    // MINTED ONCE, off the environment this row read at apply — and asked for
    // at every accept from here on, because core reads the names through this
    // door the way it reads the reading (juspay/kolu#2229). What checks them
    // is core, at the bind (`@olai/server`'s `serve.ts`): the grammar is the
    // framework's, and a second opinion in this file would be a rule that
    // drifts from the one the upgrade actually applies.
    yield* offers.offer(Identity, () => ({
      // UNIQUE, because a login that doubles as the email claim is named
      // once: the seam upstream takes a repeated name as a defect rather than
      // as two readings of one header.
      headers: headerNamesOf(config.headers),
      who: (headers) => whoOf(headers, config),
    }))
  }),
})
