/**
 * Who is looking, as this process serves it — THREE DOORS AND NO READING.
 *
 * `who.get` is the tab's door, answered from the headers the upgrade
 * carried; `GET /olai/who` is the plain-HTTP door — a share sheet, a
 * script, anything without a websocket; `/mcp` is the third, one route
 * over, attributing a write to whoever the proxy in front named
 * (`./mcp/route.ts`). What all three ask is a {@link Reading}, minted here
 * from the `Identity` door — one core DEFINES and does not stand behind:
 * the identity row offers it (`packages/plugins/identity/`), and with no
 * row mounted every request is nobody, which is exactly what a serve
 * behind no proxy already was.
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
 * ## THE DOOR HAS TWO CLOCKS, and this file is where they are separated
 *
 * `Identity` carries the header NAMES and the READING over them, together,
 * because a name nobody reads and a reading of a name nobody kept are the
 * same defect and one door is what makes them agree. But they are not
 * asked on the same schedule: the names are spent ONCE, when the port
 * binds and the socket's allowlist is fixed, and the reading is spent PER
 * REQUEST, so a row switched off mid-serve stops naming anybody from the
 * next one on.
 *
 * So nothing downstream of here is handed the door. The composition root
 * reads the names as a VALUE at the bind and mints a {@link Reading} for
 * the rest, and the listener and the MCP route take those two — a value
 * and a function, one clock each, neither of them knowing that a plugin is
 * behind either. That is also what makes the seam legible rather than
 * hidden: the once-only read is one line in `./serve.ts`, at the moment it
 * happens, instead of a `.headers` inside a thunk that reads live
 * everywhere else it is touched.
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

import type { Identity, Person, RequestHeaders } from "@olai/plugin-api/services"
import { WHO_PATH, type Who } from "@olai/surface"
import { Context, Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/** Who this connection is, already resolved — or nobody. Provided per
 *  websocket by `serveSurfaceApp`'s `services` from the upgrade headers. */
export class CurrentWho extends Context.Service<CurrentWho, Who | null>()(
  "olai/CurrentWho",
) {}

/**
 * WHO A REQUEST IS, as everything downstream of the composition root asks
 * it: headers in, a person or nobody out.
 *
 * The one thing the three readers share, and the only thing any of them
 * needs. A door would be more than that — it also carries the names, which
 * are the bind's business and nobody else's — and handing a route the door
 * is how a `.headers` read ends up somewhere it is never re-read.
 */
export type Reading = (headers: RequestHeaders) => Who | null

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
 *  chip that cannot draw what the server answered. Not exported: one
 *  reader, one line below, and a second caller would be a second place
 *  where the two spellings meet. */
const asWho = (person: Person | null): Who | null => person

/** The reading over whatever row is standing behind the door RIGHT NOW —
 *  the door asked per call rather than captured, so a row switched off
 *  mid-serve stops naming anybody from the next request on, and one
 *  switched back on names them again. */
export const readingOf = (door: () => Identity): Reading => (headers) =>
  asWho(door().who(headers))

export const whoRoute = (who: Reading) =>
  HttpRouter.add(
    "GET",
    WHO_PATH,
    (request: HttpServerRequest.HttpServerRequest) => {
      const person = who(request.headers)
      if (person === null) {
        return Effect.succeed(HttpServerResponse.empty({ status: 204 }))
      }
      return Effect.orDie(HttpServerResponse.json(person))
    },
  )
