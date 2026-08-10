/**
 * The connection, as something to look at.
 *
 * One pure table over the wire's own four states, and it is a table rather than
 * a derivation because there is nothing left to derive: the transport reports
 * `connecting` / `live` / `reconnecting` / `retired` directly, terminal state
 * included. It used to say `down` for a wire that had been retired, which is
 * where this class of bug hides — the one state that never heals, wearing the
 * name of the one that does. A page must never draw those the same.
 *
 * The four, and why a reader needs all four:
 *
 *   - `connecting` — the first dial has not answered yet. Not an alarm: every
 *     page load passes through it.
 *   - `live` — a socket is open and answering. This is the ONLY green one.
 *   - `reconnecting` — we had a server and the socket is gone; the link is
 *     re-dialling on its own. The page is showing what it last knew.
 *   - `retired` — the server closed this tab at the handshake, because the
 *     process that served it has been replaced. The link has stopped for good.
 *     There is nothing to wait for: recovery is a reload.
 */

import type { SurfaceConnectionStatus } from "@kolu/surface-app/solid"

export type { SurfaceConnectionStatus }

/** How one state is drawn: the dot's colour, the words beside it, and the
 *  longer sentence a reader gets on hover. */
export interface Look {
  /** The dot. A background utility, because the dot IS the colour. */
  readonly dot: string
  /** Two or three words, always on screen next to the dot. */
  readonly label: string
  /** What that means, spelled out — the indicator's `title`. */
  readonly detail: string
}

/** A `Record`, so every state must be given a look: an unlisted one would be a
 *  connection state with no appearance, which is the bug wearing a new hat. */
export const LOOK: Record<SurfaceConnectionStatus, Look> = {
  connecting: {
    dot: "bg-muted",
    label: "connecting",
    detail: "reaching the server that served this page",
  },
  live: {
    dot: "bg-done",
    label: "live",
    detail: "connected — the files on disk reach this page as they change",
  },
  reconnecting: {
    dot: "bg-doing",
    label: "reconnecting",
    detail:
      "the connection dropped and is being retried — what is on screen is the last thing the server said",
  },
  retired: {
    dot: "bg-alarm",
    label: "server restarted",
    detail:
      "the server that served this page has been replaced, so this page will not update again — reload it",
  },
}

/** Is this a state a reload, and only a reload, gets out of? The one place the
 *  rule lives, beside the reload it gates. */
export const needsReload = (status: SurfaceConnectionStatus): boolean =>
  status === "retired"
