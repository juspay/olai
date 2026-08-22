/**
 * Where the pin comes from: the git cell, read once for the whole document.
 *
 * ONE CHANNEL, and it is the one that already existed. What git is doing for
 * this directory is a cell (`@olai/surface`'s `git`), the header's commit pill
 * reads it, and a `--no-commit` serve has always reached a browser through it
 * as `off`. The `--commit` / `--push` pin rides that same value rather than a
 * cell of its own: it is the same server's answer about the same directory, it
 * is seeded with the same `GIT_OFF`, and a second cell would be a second moment
 * for a page to be holding one of them and not the other.
 *
 * SEPARATE FROM `./pinned.ts` because this file imports the connection and that
 * one must not: the preferences it gates are read by unit tests that have no
 * server, and a preference module that dialled a websocket on import would take
 * them all with it.
 *
 * `createRoot`, and started from `main.tsx` beside `followAutoCommit` and the
 * rest: this subscription belongs to the DOCUMENT and lives exactly as long as
 * it does, so its teardown is dropped for the reason every other follower's is
 * — the only thing that ends this page also ends the wire.
 */

import { createEffect, createRoot } from "solid-js"

import { NO_PIN } from "@olai/format"

import { setPinned } from "./pinned.ts"
import { olai } from "../wire.ts"

/** Follow what the server pinned, for as long as this document lives. */
export const followPin = (): void => {
  createRoot(() => {
    const cell = olai.cells.git.use()
    // Before the first frame the cell reads its seed, whose pin is NO_PIN — so
    // a page draws its own preferences until it is told otherwise, rather than
    // flashing a frozen row at a reader on a server that pinned nothing.
    createEffect(() => setPinned(cell.value()?.pinned ?? NO_PIN))
  })
}
