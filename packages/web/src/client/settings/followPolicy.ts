/**
 * Where the git policy comes from: the git cell, read once for the whole
 * document.
 *
 * ONE CHANNEL, and it is the one that already existed. What git is doing for
 * this directory is a cell (`@olai/surface`'s `git`), the header's commit pill
 * reads it, and a `--no-commit` serve has always reached a browser through it
 * as `off`. The POLICY, the PIN and the PAUSE ride that same value rather than
 * cells of their own: they are the same server's answer about the same
 * directory, they are seeded with the same `GIT_OFF`, and a second cell would
 * be a second moment for a page to be holding one of them and not the other.
 *
 * SEPARATE FROM `./policy.ts` because this file imports the connection and that
 * one must not: the rows it gates are read by unit tests that have no server,
 * and a preference module that dialled a websocket on import would take them
 * all with it.
 *
 * `createRoot`, and started from `main.tsx` beside the rest: this subscription
 * belongs to the DOCUMENT and lives exactly as long as it does, so its teardown
 * is dropped for the reason every other follower's is — the only thing that
 * ends this page also ends the wire.
 */

import { createEffect, createRoot } from "solid-js"

import { GIT_OFF } from "@olai/format"

import { setGitSaid } from "./policy.ts"
import { olai } from "../wire.ts"

/** Follow what the server says about git, for as long as this document
 *  lives. */
export const followPolicy = (): void => {
  createRoot(() => {
    const cell = olai.cells.git.use()
    // Before the first frame the cell reads its seed, whose pin is nobody's and
    // whose policy is the defaults — so a page draws a live, unpaused pair of
    // rows until it is told otherwise, rather than flashing a frozen row at a
    // reader on a server that pinned nothing.
    createEffect(() => setGitSaid(cell.value() ?? GIT_OFF))
  })
}
