/**
 * IDENTITY'S SERVER HALF — the reading, as a row.
 *
 * Two lines of work and no state: decode the vault’s identity
 * policy at activation, and stand behind the `Identity` door with the names it
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
 * ## Policy belongs to the activation
 *
 * The shared revision reader supplies decoded options. A config edit replaces
 * this activation and its Identity offer; each request consults the current
 * provider. No request reparses configuration or reads environment policy.
 */

import { definePlugin, Identity, Offers } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name, browserServices } from "./index.ts"
import { headerNamesOf, whoOf } from "./who/index.ts"

import { Config, configuredIdentity } from "./settings.ts"
export { Config } from "./settings.ts"

export { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [Offers],
  config: Config,
  apply: (settings) => Effect.gen(function*() {
    const offers = yield* Offers
    yield* offers.browser(browserServices)
    const config = configuredIdentity(settings)
    // MINTED ONCE, from the schema options supplied at apply — and asked for
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
