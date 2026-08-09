/**
 * The connection, as something to look at.
 *
 * Two pure steps, and they are separate because they answer different
 * questions. `connectionOf` narrows the framework's lifecycle event to the four
 * states a READER can act on; `LOOK` says what each of the four looks like.
 * Neither touches a socket or a signal, which is what makes the whole mapping
 * testable — and the mapping is where this class of bug hides: a state that
 * quietly reads as healthy is exactly how a dead tab went unnoticed.
 *
 * The four states, and why they are four:
 *
 *   - `connecting` — the first dial has not answered yet. Not an alarm: every
 *     page load passes through it.
 *   - `live` — a socket is open and a probe has told us which process is on the
 *     other end. This is the ONLY green one.
 *   - `lost` — we had a server and the socket is gone. The link is re-dialling;
 *     the page is showing whatever it last knew.
 *   - `restarted` — the process that served this page has been replaced. There
 *     is nothing to wait for, no retry that helps: recovery is a reload. Both
 *     ways it arrives collapse here on purpose — the tab closed at the
 *     handshake (a wire that has RETIRED and will never dial again) and the
 *     reconnect that landed on a different process are the same news to a
 *     reader, who is either way looking at a page from a server that is gone.
 */

import type { ServerLifecycleEvent } from "@kolu/surface-app/solid"

export type Connection = "connecting" | "live" | "lost" | "restarted"

/** The lifecycle event, narrowed to what a reader can act on. Exhaustive over
 *  the event's `kind` — a new arm in the framework is a type error here rather
 *  than a state that silently reads as one of these. */
export const connectionOf = (event: ServerLifecycleEvent): Connection => {
  switch (event.kind) {
    case "connecting":
      return "connecting"
    case "connected":
    case "reconnected":
      return "live"
    case "disconnected":
      return "lost"
    case "restarted":
      return "restarted"
  }
}

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
export const LOOK: Record<Connection, Look> = {
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
  lost: {
    dot: "bg-alarm",
    label: "disconnected",
    detail:
      "the connection dropped and is being retried — what is on screen is the last thing the server said",
  },
  restarted: {
    dot: "bg-alarm",
    label: "server restarted",
    detail:
      "the server that served this page has been replaced, so this page will not update again — reload it",
  },
}

/** Is this a state a reload, and only a reload, gets out of? The one place the
 *  rule lives, beside the reload it gates. */
export const needsReload = (connection: Connection): boolean =>
  connection === "restarted"
