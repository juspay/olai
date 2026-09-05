/**
 * Who is looking, as this process serves it — THREE DOORS AND NO READING.
 *
 * `who.get` is the tab's door, answered from the headers the upgrade
 * carried; `GET /olai/who` is the plain-HTTP door — a share sheet, a
 * script, anything without a websocket; `/mcp` is the third, one route
 * over, attributing a write to whoever the proxy in front named
 * (`./mcp/route.ts`). What all three ask is `Identity.who`, a door core
 * DEFINES and does not stand behind: the identity row offers it
 * (`packages/plugins/identity/`), and with no row mounted every request is
 * nobody — which is exactly what a serve behind no proxy already was.
 *
 * WHAT LEFT WHEN THE ROW ARRIVED is worth naming, because what is left
 * here looks thin: this file used to hold the mapping from a parsed
 * identity onto the surface's `Who`, which meant core knew that a picture
 * is resolved down a ladder and could be asked which rung a deployment was
 * on. It knows a login, a name and a picture URL now, and where they came
 * from is the row's business. The one line that remains about the ANSWER
 * is {@link asWho}, and it is a type assertion in prose form: the door's
 * `Person` and the surface's `Who` are the same three fields, spelled in
 * two packages that may not import each other, and this is the one place
 * both are in hand.
 *
 * The per-connection service is what `who.get` yields. `serveSurfaceApp`'s
 * `services` layer provides it from the upgrade; a handler that required
 * it without that layer would be a boot-time hole, which is why the
 * listener always installs one — even on a serve with no identity row,
 * where what it provides is `null`.
 *
 * A picture is a remote `<img>` on the app page, and its origin is the
 * operator's: an IdP's avatar host, a template's host, or gravatar. The
 * shell's image policy admits `https:` for exactly that reason
 * (`packages/web/src/client/index.html`, and the `policy.test.ts` beside
 * it says why); sealed `/media` pages keep their own, stricter, policy and
 * do not.
 */

import type { Identity, Person } from "@olai/plugin-api/services"
import { WHO_PATH, type Who } from "@olai/surface"
import { Context, Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/** Who this connection is, already resolved — or nobody. Provided per
 *  websocket by `serveSurfaceApp`'s `services` from the upgrade headers. */
export class CurrentWho extends Context.Service<CurrentWho, Who | null>()(
  "olai/CurrentWho",
) {}

/**
 * WHAT NOBODY LOOKS LIKE — the door as it reads with no row behind it.
 *
 * Not a stand-in for a reading and not a mode: it names no header, so the
 * upgrade keeps none, and it answers `null` for every request, which is
 * the state a direct loopback call is in whether or not a row is mounted.
 * A composition root asks for the offered door and falls back to this, the
 * way `ops.commit` falls back to a ledger nobody stands behind.
 */
export const NOBODY: Identity = {
  headers: [],
  who: () => null,
}

/** The door's answer as the surface carries it. `Person` (the door) and
 *  `Who` (the wire) are the same three fields declared in two packages
 *  that may not import each other; this is the one expression where both
 *  are in hand, so a drift between them is a type error HERE rather than a
 *  chip that cannot draw what the server answered. */
export const asWho = (person: Person | null): Who | null => person

/** The reading, per REQUEST, through whatever row is standing behind the
 *  door right now — read per call rather than captured, so a row switched
 *  off mid-serve stops naming anybody from the next request on. */
export const whoOf = (
  headers: {
    readonly [name: string]: string | ReadonlyArray<string> | undefined
  },
  identity: () => Identity,
): Who | null => asWho(identity().who(headers))

export const whoRoute = (identity: () => Identity) =>
  HttpRouter.add(
    "GET",
    WHO_PATH,
    (request: HttpServerRequest.HttpServerRequest) => {
      const who = whoOf(request.headers, identity)
      if (who === null) {
        return Effect.succeed(HttpServerResponse.empty({ status: 204 }))
      }
      return Effect.orDie(HttpServerResponse.json(who))
    },
  )
