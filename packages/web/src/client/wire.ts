/**
 * The one connection.
 *
 * TOP-LEVEL AWAIT, deliberately: `connectSurface` is async because the dial is
 * an Effect and building the protocol's fibers cannot be run synchronously.
 * Awaiting it here, once, keeps every consumer's import synchronous-looking.
 * It does NOT block on the socket opening — the link constructs the socket and
 * retries on its own fiber — so this is a microtask, not a network wait.
 *
 * This is the only file in the client that knows a websocket exists.
 */

import { surface } from "@olai/surface"
import { connectSurface } from "@kolu/surface-app/solid"

const url = (): string => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${location.host}/rpc/ws`
}

const connection = await connectSurface({ surface, url })

export const olai = connection.client
export const connectionStatus = connection.status
