/**
 * THE TWO WORDS A NODE AGENT'S BINDING IS SPELLED WITH — and NOTHING ELSE.
 *
 * ## Why this is a module of its own
 *
 * They were `./kinds.ts`'s, beside the claim table and the admission rule, and
 * that is where a plugin's words normally live (`olai-plugin-kolu`'s
 * `TERMINAL_KIND`, `olai-plugin-odu`'s `WORKTREE_KIND`). This one is different
 * for one reason: **another plugin needs it**. A Spaces mirror posts what a
 * node agent's conversation says, so it has to know which column that binding is
 * in — and the Cordis phase made that expressible, retiring *no plugin consumes
 * a plugin* in favour of `needs` as a reactive dependency arm
 * (`@olai/bundle`'s `fence.test.ts`, which says so in its own words).
 *
 * What a consumer must NOT have to pay for is a graph. `./kinds.ts` reaches
 * `@olai/format` for the admission rule and `./wire.ts` for this plugin's name;
 * `./server.ts` reaches an ACP transport and a subprocess. So the words sit
 * here, in a file with **no imports at all**, published as
 * `olai-plugin-chat/binding` — the discipline `./testids.ts` already keeps one
 * door over: NAMES ONLY, so the closure is one file and a consumer that wanted
 * one string got one string.
 *
 * NOT TO BE CONFUSED WITH `./server/binding.ts`, which is the two GESTURES that
 * bind a node to a conversation. That module is this word spent; this one is
 * the word.
 *
 * ## THE COMPOSED WORD IS A LITERAL HERE, and what holds it honest
 *
 * `SESSION_TYPE` was `` `${name}-${SESSION_KIND}` `` — the composition
 * `@olai/plugin-api`'s `kindWordOf` performs at the registry, spelled a second
 * time for this package's own readings, which want the word at MODULE SCOPE
 * where no registration has happened. It cannot be composed here, because
 * composing it means importing this plugin's `name` and this file imports
 * nothing.
 *
 * So it is written out, and `./kinds.test.ts` holds it equal to
 * `kindWordOf(name, SESSION_KIND)` — the real composition, over this plugin's
 * real name. That is the same trade every structural agreement in this tree
 * makes (`@olai/bundle`'s `kinds.test.ts` holds the tenants' constants against
 * what the bundle actually composes), and it is what makes a door with an empty
 * graph safe: the drift a hand-copied constant could hide is a red test rather
 * than a column two plugins disagree about.
 */

/**
 * The BARE word this plugin contributes. The registry prefixes it with this
 * plugin's name, so what a vault actually writes is {@link SESSION_TYPE}.
 *
 * IT CARRIES A HYPHEN OF ITS OWN, which is the one thing about this kind that
 * is not like the tenants': `kindWordOf` splits at the FIRST hyphen, so
 * `chat-agent-session` decomposes to `chat` and `agent-session` and the
 * composition stays injective. `@olai/plugin-api`'s `contract.ts` argues that
 * asymmetry where the rule is.
 */
export const SESSION_KIND = "agent-session"

/** ...and the word a DECLARATION writes:
 *  `{"title":"agent-session","custom":{"type":"chat-agent-session"}}`. The
 *  header argues why it is a literal rather than a composition, and which bench
 *  holds it to the real one. */
export const SESSION_TYPE = "chat-agent-session"
