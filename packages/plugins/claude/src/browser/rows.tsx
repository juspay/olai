/**
 * THIS ENGINE'S TWO ROWS IN THE CHAT PANEL — the words, where core keeps the
 * shape.
 *
 * ## What each of them is, and what core still owns
 *
 * `AgentRow` is this engine's row in the panel's *which agent?* question. Core
 * owns the pressable row, the mark beside it, the order the rows come in and
 * what the press does; what arrives from here is what a person reads. It is
 * drawn only where this machine actually HAS the agent — the panel filters the
 * slot table by the roster, because a picker's promise is that a row it draws is
 * an agent you can talk to.
 *
 * `AgentInstall` is the other face of the same fact: the row on the face drawn
 * when the machine has NO agent at all. Core owns the list, the mark and the
 * link's element; what arrives is the sentence and where the link goes.
 *
 * ## Why they are here rather than in `@olai/web`
 *
 * They were there: a `WHERE_FROM` record keyed by a closed `AgentId` union, and
 * a picker that drew `state.roster` and looked a mark up in a table of three.
 * Neither can exist now — `packages/bundle/src/fence.test.ts` holds as an
 * equality per package that no general package spells a plugin's name in code,
 * and an engine is a plugin. The rule is the right one rather than an obstacle:
 * what an engine is CALLED and how a person gets it are facts its own package
 * knows, and a core table of them is a file edited every time an engine core has
 * never heard of ships.
 *
 * The tab follows the roster, so this chunk is fetched only when the serve says
 * `claude` is running: `--plugins=opencode,pi` draws no Claude row on either
 * face, with nothing in core knowing why.
 *
 * ## The sentence is spelled ONCE
 *
 * {@link ../install.ts} — the same value the server half registers as its
 * `missing` on `Agents`. Two halves, no shared graph, one string.
 */

import type { JSX } from "solid-js"

import { INSTALL, NAME } from "../install.ts"

/** The row in the *which agent?* question: what a person reads. */
export const AgentRow = (): JSX.Element => <span class="truncate">{NAME}</span>

/**
 * ...and the row on the no-agent face: where to get it, and the one thing to do
 * about it.
 *
 * A LINK ONLY WHERE THERE IS A PLACE. `where` is `null` for an engine that names
 * none, and a dead anchor around a name is worse than the plain name — so the
 * arm is here rather than assumed, in the package that knows whether there is
 * somewhere to point at.
 */
export const AgentInstall = (): JSX.Element => (
  <>
    {INSTALL.where === null ? <span class="text-ink">{INSTALL.name}</span> : (
      <a
        class="text-ink underline underline-offset-2"
        href={INSTALL.where}
        target="_blank"
        rel="noreferrer"
      >
        {INSTALL.name}
      </a>
    )}
    <span>{` — ${INSTALL.why}`}</span>
  </>
)
