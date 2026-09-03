/**
 * WHERE THIS PACKAGE MAY LOOK FOR AN AGENT, and what it says when it found
 * none.
 *
 * ## What used to be here, and where it went
 *
 * `Adapter`, `adapterFrom` and `OLAI_ACP_PI`. The first two are the shape of
 * *what to spawn to reach an ACP agent*, which is a thing an ENGINE PLUGIN
 * answers and `@olai/chat` consumes — so they are `@olai/acp/engine`'s now,
 * under both walls, which is what lets neither side import the other. The third
 * was one engine's own door onto one pin, and it is in that engine's directory
 * with that engine's patches (`olai-plugin-pi`'s `server.ts`).
 *
 * `OLAI_ACP_AGENT` is `@olai/acp/engine`'s too, and for a sharper reason than
 * tidiness: it has TWO readers who mean two things by it, and both readings are
 * argued at the constant. The Claude engine reads it as its adapter; this
 * package reads the EMPTY STRING as the whole off switch — the panel, not one
 * row — before anything is probed ({@link ./agents/roster.ts}).
 *
 * ## What is left, and why both halves are core's
 *
 * WHERE THE PROBES LOOK, and WHAT A PERSON IS TOLD when nothing answered.
 * Neither is one engine's: the search path is a fact about this SERVE (a systemd
 * unit inherits neither your profile nor your login shell), and the log line is
 * about the roster as a whole rather than about any row of it. What the line may
 * NOT do is name an engine — core displays a sentence and never composes one —
 * so it says how olai looked and points at the panel, which draws each enabled
 * engine's own words.
 *
 * With no agent, olai serves the outlines exactly as it does with one: reading a
 * directory does not depend on an agent being installed. What it does NOT do is
 * hide the feature — the panel draws, and says there is no agent and which
 * variable would give it one. A missing capability the user can see explained is
 * worth more than a button that silently is not there.
 */

import { AGENT_ENV } from "@olai/acp/engine"

/** The variable, spelled once — `@olai/acp/engine`'s, re-exported so this
 *  package's own readers reach it where they already reach for the roster's
 *  vocabulary. Its two meanings are argued there. */
export { AGENT_ENV }

/** ... and the one saying where the OTHER agents are looked for. Its rules are
 *  {@link ./agents/roster.ts}'s; spelled here because a module that imported the
 *  roster for one string would be the roster importing itself (the roster reads
 *  this file). */
export const AGENT_PATH_ENV = "OLAI_AGENT_PATH"

/**
 * Why the roster is EMPTY, as a line for the log.
 *
 * The two cases read differently on purpose: an EMPTY variable is somebody
 * saying "not this time" — and it is the whole off switch, so nothing else was
 * even looked for — while an absent one is a launch path that did not go through
 * the wrapper or the justfile, which is worth pointing at because every
 * documented path bakes the default in. The second line also names the other
 * variable, because "olai cannot see the opencode I installed" is a PATH
 * question and this is the line somebody greps.
 *
 * NO ENGINE IS NAMED IN EITHER, and that is not a loss of detail — it is the
 * fence. Which engines this build has is a list of ROWS, each with its own
 * sentence about how to get it, and the panel draws all of them
 * ({@link ./agents/roster.ts}). A log line that spelled three of them would be
 * core knowing an engine by name and would go stale the day a fourth row is
 * added, which is the one edit this whole phase exists to make cost nothing.
 */
export const whyNoAgent = (value: string | undefined): string =>
  value === undefined
    ? `no agent: ${AGENT_ENV} is unset and nothing baked one in — the packaged binary and ` +
      `\`just serve\` both default to the pinned adapter, so this is a hand-rolled start — and ` +
      `no other engine this build has found what it looks for on ${AGENT_PATH_ENV} (or PATH, ` +
      `where that is unset). The outlines are served as usual, and the chat panel says the same ` +
      `thing with each engine's own words on how to get it.`
    : `no agent: ${AGENT_ENV} is set to the empty string, which is the explicit off switch — the ` +
      `whole panel, so nothing else was looked for either. The outlines are served as usual and the ` +
      `chat panel says so.`
