/**
 * CONVERSATIONS, AS A ROW THAT IS NOT CHAT ASKS FOR THEM — chat standing
 * behind a door CORE declares, and this module's one job is the provision
 * behind it.
 *
 * ## Why core's key and not one of chat's own
 *
 * It was `chat.conversations`, offered with `Offers.own`, and a consumer named
 * it on a component of its own. That is the right shape for a provider which is
 * optional to HAVE and wrong for one which is optional to EXIST, and
 * `@olai/plugin-api`'s own `HostServices` paragraph says why in a sentence this
 * branch then proved on a serve: a row's report FOLDS its components, so the
 * component waiting for a chat that is switched off made the whole
 * `vault-plugins` row read `waiting` — out of the roster, chunk never loaded,
 * and a plugin's page that has nothing to do with chat gone with it.
 *
 * So the key is {@link Conversations}, which is core's and is in `OFFERABLE`,
 * and core brokers it with {@link ConversationsWatch} the way it brokers the
 * settings reader. Chat stands behind it while chat is up; the broker answers
 * `undefined` while it is not; and a consumer draws its own absent arm — a
 * folder minted with nobody building it, and a page that says so.
 *
 * ## What the door promises, and what it refuses to
 *
 * {@link Conversations.open} is the three-act mint a person's *New chat* makes,
 * reached by a row instead: ensure the container, add the node, start the
 * session — and then the first message, which is where `teach` rides. It
 * answers the NODE whatever happens next, because a conversation that exists
 * and would not start is something a person can open later, and one that was
 * never minted is a plugin with nobody building it.
 *
 * {@link Conversations.say} is write-only and lands the way a doorbell's
 * delivery does — an idle agent takes it as a turn, a running one takes it at
 * the boundary — and which arm it took is deliberately not reported back.
 *
 * {@link Conversations.engines} is the machine's answer rather than the
 * vault's: which engines are MOUNTED and can actually be started here, best
 * first. A caller that has to choose one needs the list the panel's own picker
 * draws from, and an empty list is a serve with nothing to talk to — on which
 * {@link Conversations.open} refuses in chat's own words.
 */
import { Conversations } from "@olai/plugin-api/services"

export { Conversations }
