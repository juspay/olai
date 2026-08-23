/**
 * WHERE `olai surface` DIALS, and how it opens.
 *
 * The endpoint seam `@kolu/surface-cli` leaves to the app, because where a
 * server is reachable is a fact about the product and nothing in the projection
 * knows what a socket is. What it takes back is one `resolve` answering the
 * endpoint's NAME beside the thunk that opens it — the name is what a FAILED
 * dial has to report, which is exactly when there is no connection left to ask.
 *
 * THE ORDER, and why each rung is under the one above it:
 *
 *   1. `--socket` — somebody typed it, so nothing may overrule it.
 *   2. `$OLAI_SOCKET` — the same choice, made once for a shell.
 *   3. `.olai-dev/surface.sock`, walking UP from the working directory — a
 *      worktree's own `just run` binds one there, so running the CLI inside a
 *      checkout talks to THAT checkout's server rather than to the user
 *      service. It is the rung that makes a dev loop work without a flag, and
 *      the reason the dev server does not take the per-user path: two servers
 *      cannot bind one socket, and the one that loses would serve nothing.
 *   4. the per-user runtime socket — the convention `olai web` binds with no
 *      configuration on either side. The two ends agree because neither chose.
 *
 * EVERY RUNG IS A SOCKET, and there is deliberately no `--url`. A websocket
 * reaches `serveSurfaceApp`, which serves `BROWSER_FACE` — and that face
 * exposes neither the ops vocabulary every bespoke verb lands on nor the
 * `outlines` collection (`./faces.ts` argues both), so a URL could not carry
 * `capture`, `add_node`, or even `get outlines`. A flag that reaches no verb
 * this face offers is a flag whose `--help` is untrue, and the fix for it — a
 * second websocket face, or widening the browser's — was ruled out (human,
 * 2026-08-22) along with the HTTP door this whole change retires.
 *
 * REMOTE IS SSH, therefore, and that is the arrangement `docs/running.md`
 * documents: `ssh <vault-host> olai surface capture …`, where ssh is the
 * authentication and the socket on the far side is the same one a local run
 * dials. There is no bearer to mint and no header to trust, which is the knot
 * the retired door was tied around.
 */

import { buildSurfaceFace, type SurfaceClientCallable } from "@kolu/surface/client"
import { unixSocketLink } from "@kolu/surface/links/unix-socket"
import { getRuntimeSocketPath } from "@kolu/surface/unix-socket"
import type { ResolvedEndpoint, SurfaceCliConnection } from "@kolu/surface-cli"
import { surface } from "@olai/surface"
import { Effect, Option } from "effect"
import * as fs from "node:fs"
import * as path from "node:path"

/** The socket a worktree's own `just run` binds, relative to the checkout. Not
 *  the per-user path, because a dev server and the user service would fight for
 *  that one and the loser would quietly serve nothing. */
export const DEV_SOCKET_FILE = ".olai-dev/surface.sock"

/** What the endpoint flags are, as `surfaceCommands` takes them. A shared root
 *  flag, position-independent, so `olai surface --socket … capture …` and
 *  `olai surface capture … --socket …` are the same command. */
export interface Dialled {
  readonly socket: Option.Option<string>
}

/** The nearest worktree socket at or above `from` — or nothing, which is every
 *  directory that is not a checkout with a server running in it.
 *
 *  EXISTENCE IS THE WHOLE TEST, and liveness deliberately is not. A socket file
 *  left behind by a dead server names an endpoint nothing answers on, and what
 *  a caller gets then is the CLI's own "nobody serving at …" naming that path —
 *  which is the useful sentence. Probing here would replace it with a silent
 *  fall-through to the user service, and a write that lands in the WRONG
 *  directory is far worse than a write that is refused. */
export const devSocketNear = (from: string): string | undefined => {
  let at = path.resolve(from)
  for (;;) {
    const candidate = path.join(at, DEV_SOCKET_FILE)
    if (fs.existsSync(candidate)) return candidate
    const up = path.dirname(at)
    if (up === at) return undefined
    at = up
  }
}

/** One endpoint: the path, and the connection opening it yields. */
const overSocket = (socketPath: string): ResolvedEndpoint => ({
  where: socketPath,
  open: async (): Promise<SurfaceCliConnection> => {
    const link = await unixSocketLink({ group: surface.group, socketPath })
    return {
      client: buildSurfaceFace(surface, link.dispatch) as SurfaceClientCallable,
      // Required, not optional: a CLI dials, does one thing and exits, and the
      // one failure that costs anybody something is a socket left open in a
      // shell loop.
      dispose: () => link.dispose(),
    }
  },
})

/**
 * The resolution, as one step — the ladder above, read top to bottom.
 *
 * An EFFECT because a resolution order that can come up empty needs somewhere
 * to say so; this one cannot (the last rung is a convention, not a lookup), but
 * the seam is that shape for an app whose order can, and answering in it costs
 * nothing.
 */
export const dialOlai = (values: Dialled): Effect.Effect<ResolvedEndpoint> =>
  Effect.sync(() => {
    const said = Option.getOrUndefined(values.socket)
    if (said !== undefined) return overSocket(said)

    const fromEnv = process.env["OLAI_SOCKET"]
    if (fromEnv !== undefined && fromEnv !== "") return overSocket(fromEnv)

    const dev = devSocketNear(process.cwd())
    if (dev !== undefined) return overSocket(dev)

    return overSocket(getRuntimeSocketPath({ app: "olai", file: "surface.sock" }))
  })
