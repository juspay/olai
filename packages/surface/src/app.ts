/**
 * What this app is CALLED where the OS asks for a name — the word, with the
 * machine the server runs on in brackets: `olai [desk]`.
 *
 * The box matters because one person runs olai on two of them: a laptop and a
 * server, two servers, a dev box and a NUC. Untitled by machine, their tabs
 * and their installed apps are identical, and telling "which olai is this"
 * apart is guessing. The browser cannot know the machine's name — it is a
 * property of the process — so it crosses here, the way who is looking
 * crosses in `./who.ts`, and the one spelling below is what every surface of
 * it draws: the tab's title, the header's wordmark, and the install
 * manifest's `name` (`@olai/server`'s `manifest.ts`).
 *
 * A PROCEDURE (`app.get`), not a cell: a cell is a stream of updates, and the
 * machine's name does not move for the life of the process — there is nothing
 * to subscribe to, exactly the shape `who.get` argues beside it. THE
 * BROWSER'S ALONE: an agent is told which vault it is acting on, not which
 * brand of chrome drew a tab.
 */

import { Schema } from "effect"

/** The whole of the crossing: the machine's own `os.hostname()`, as read by
 *  the one receptacle for it, `@olai/server`'s `hostname.ts` (`OLAI_HOSTNAME`
 *  wins there — the e2e harness pins it so the name landing on a tab is
 *  checkable against a known string). */
export const App = Schema.Struct({
  hostname: Schema.String,
})
export type App = typeof App.Type

/** The one spelling of it. Every face of the app names itself with THIS —
 *  a face that re-composed it would be the day two of them disagreed. */
export const appName = (hostname: string): string => `olai [${hostname}]`
