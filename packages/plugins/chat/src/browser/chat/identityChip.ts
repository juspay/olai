/**
 * WHO the agent is signed in as, as a line short enough to sit in the agent
 * line — and as the longer account of itself a `title` can hold.
 *
 * `Claude Max · you@example.com`. The label is the AGENT'S own ready-made
 * string ("Claude Max", "ChatGPT Plus", "Anthropic API key") and the second
 * half is the one fact that tells two accounts of the same plan apart: the
 * email when the agent stated one, and its own `detail` — a key source, a
 * gateway host — when it did not. A person with a work and a personal
 * subscription reads the plan on both and the address on one, and this is the
 * line that has to make them distinguishable at a glance.
 *
 * `Not signed in` for the one known state of nobody being signed in
 * (`kind: "none"`). Olai's own words rather than the agent's label, because the
 * question the chip answers is "which account is this conversation going to run
 * as" and "not logged in" reads like an error where "not signed in" reads like
 * a state. `null` — an agent that does not report — draws no chip at all
 * ({@link identityOf}), and is deliberately not the same thing.
 *
 * Organization, plan and the agent's detail go in the `title` and never in the
 * line: the line has to stay one glance wide, and a plan string is the fact
 * that matters least often.
 */

import type { AuthStatus } from "olai-plugin-chat/wire"

/** The chip's own words: `label · email`, `label · detail`, `label`, or
 *  `Not signed in`. */
export const identityOf = (identity: AuthStatus): string => {
  if (identity.kind === "none") return "Not signed in"
  const second = identity.account?.email ?? identity.detail
  return second === null || second === undefined ? identity.label : `${identity.label} · ${second}`
}

/**
 * Everything the agent said, on one line for the chip's `title` — the same
 * fields the line shows plus the ones it leaves out, deduplicated so an agent
 * that reports its email as both `account.email` and `detail` is not read
 * twice.
 */
export const identityTitleOf = (identity: AuthStatus): string => {
  if (identity.kind === "none") return "Not signed in"
  const parts = [
    identity.label,
    identity.account?.email,
    identity.account?.organization,
    identity.account?.plan,
    identity.detail,
  ].filter((part): part is string => typeof part === "string" && part.trim() !== "")
  return [...new Set(parts)].join(" · ")
}
