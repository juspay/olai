/** One lazy viewer resource per tab, shared by header and transcript.
 * It follows the connection epoch even when a contributing face is unloaded. */

import { createRoot } from "solid-js"

import { type Asking, createWho } from "./asking.ts"

/** The one asker, made the first time anybody wants it. */
let mine: Asking | null = null

/** Who is looking, shared. Every caller gets the same accessor over the same
 *  ask, so a face drawn nine times reads one answer nine times. */
export const whoAmI = (): Asking => (mine ??= createRoot(() => createWho()))
