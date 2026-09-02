/**
 * WHICH PLUGIN'S FACE, by the name core stamped on the row.
 *
 * A plugin may put a sentence into a person's conversation, and core marks that
 * row with the plugin's NAME and nothing else (`@olai/surface`'s
 * `UserEntry.rang`). The panel draws such a row as a speaker in its own right
 * and every speaker there wears a mark — so this is the lookup from that name
 * to the shapes the plugin registered in the `chat.speaker.mark` slot.
 *
 * ## Why a lookup and not a table
 *
 * Because a table would have this file spelling "kolu", and `@olai/bundle`'s
 * `fence.test.ts` holds as an equality per package that no general package
 * does — which is not a formality: a mark is a drawing decision about a tenant,
 * made where somebody knows what the tenant IS, and a table here would be a
 * core file edited every time a plugin core has never heard of ships.
 *
 * ## What a mark for a plugin that is NOT running means now
 *
 * `undefined`, and the change is worth stating because it reverses an argument.
 * This walk used to read the BUILD's manifests rather than the running set, on
 * the grounds that a `rang` row is its own evidence: the plugin ran and
 * delivered a sentence, so withholding its face because a later readout says it
 * is not composed would strip the mark off a row that is manifestly there.
 *
 * That reasoning was sound and its premise is gone. A plugin the roster does
 * not name has no fiber in this tab — its chunk was never fetched — so there is
 * no mark to hold back and nothing to decide. A row rung by a plugin this serve
 * has since stopped running draws the generic, which is the same bargain a row
 * rung by a plugin a later build dropped already got, and is honest: this tab
 * does not have that plugin's drawing.
 *
 * ## Why `undefined` rather than a fallback here
 *
 * The generic is a DRAWING — an svg the panel owns — and this module answers a
 * question about the slot table. Handing back a component either way would put
 * core's own generic behind a function whose name says "the plugin's", and the
 * one bug this whole arrangement exists to prevent is a plugin appearing to
 * have contributed something it did not. The face picks
 * ({@link ../chat/PluginMark.tsx}).
 */

import type { PluginMark } from "@olai/plugin-api"

import { hung } from "./runtime.ts"

/** The mark this plugin registered, or `undefined` — for a plugin that hangs
 *  none, and for a name no plugin running in this tab answers to. */
export const markOf = (name: string): PluginMark | undefined =>
  hung("chat.speaker.mark").find((one) => one.plugin === name)?.face
