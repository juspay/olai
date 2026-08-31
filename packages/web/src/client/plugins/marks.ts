/**
 * WHICH PLUGIN'S FACE, by the name core stamped on the row.
 *
 * A plugin may put a sentence into a person's conversation, and core marks that
 * row with the plugin's NAME and nothing else (`@olai/surface`'s
 * `UserEntry.rang`). The panel draws such a row as a speaker in its own right
 * and every speaker there wears a mark — so this is the lookup from that name
 * to the shapes the plugin contributed (`@olai/plugins`' `PluginMark`).
 *
 * ## Why a lookup and not a table
 *
 * Because a table would have this file spelling "kolu", and `@olai/plugins`'
 * `fence.test.ts` holds as an equality per package that no general package does
 * — which is not a formality: a mark is a drawing decision about a tenant, made
 * where somebody knows what the tenant IS, and a table here would be a core
 * file edited every time a plugin core has never heard of ships. So the shape
 * arrives on the manifest and this walk is the whole of core's part in it.
 *
 * ## Why the roster and not the RUNNING roster
 *
 * `./running.ts` gates the chrome and the dressings on what this serve actually
 * composed, because those faces are drawn speculatively — a readout for an
 * appliance the operator turned off would be a complaint about a daemon nobody
 * asked for. Nothing here is speculative. A `rang` row EXISTS because that
 * plugin ran and delivered a sentence, so the row is its own evidence, and a
 * mark withheld because a later readout says the plugin is not composed would
 * strip the face off a row that is manifestly there. (It is also the honest
 * answer for the seam in between: a plugin that has since stopped still said
 * this.)
 *
 * ## Why `undefined` rather than a fallback here
 *
 * The generic is a DRAWING — an svg the panel owns — and this module answers a
 * question about a manifest. Handing back a component either way would put
 * core's own generic behind a function whose name says "the plugin's", and the
 * one bug this whole arrangement exists to prevent is a plugin appearing to
 * have contributed something it did not. The face picks
 * ({@link ../chat/PluginMark.tsx}).
 */

import type { PluginMark } from "@olai/plugins"

import { ROSTER } from "./roster.ts"

/** The mark this plugin contributed, or `undefined` — for a plugin that hangs
 *  none, and for a name no manifest in this build answers to (a conversation
 *  rung by a plugin a later build dropped). */
export const markOf = (name: string): PluginMark | undefined =>
  ROSTER.find((plugin) => plugin.name === name)?.mark
