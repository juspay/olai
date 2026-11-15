/**
 * THE CONVERSATION THAT BUILDS A PLUGIN — reached through core's broker, so a
 * serve with no chat still has plugins.
 *
 * ## Why not a `needs`, and why not a component either
 *
 * Both were tried on this branch and the second one shipped for an afternoon,
 * which is how the rule in `@olai/plugin-api`'s `HostServices` paragraph got
 * proved rather than read: **a component is for a half that is optional to
 * HAVE, not for a provider that is optional to EXIST.** A row's report FOLDS
 * its components, so a component waiting for a chat somebody switched off made
 * this whole row read `waiting` — which took it out of the roster, stopped the
 * tab loading its chunk, and took the plugin's page, the sidebar's section and
 * the palette's row with it. A page about a folder has nothing to do with chat
 * and must not leave when chat does.
 *
 * ## What it is instead
 *
 * `ConversationsWatch` — core's narrow broker over the optional provider, the
 * same arrangement it has over the settings reader. Core always provides the
 * broker, so naming it costs no wait; the broker answers `undefined` while
 * nobody stands behind {@link Conversations}; and this row draws its own absent
 * arm for that, which is a folder minted with nobody building it and a page
 * that says there is no agent to ask.
 *
 * READ PER CALL and never held: the roster moves under a standing reader, and
 * a door kept from a chat that has since stopped is a message delivered
 * nowhere.
 */
import { ConversationsWatch } from "@olai/plugin-api/services"

export { ConversationsWatch }
export type { Conversations } from "@olai/plugin-api/services"
