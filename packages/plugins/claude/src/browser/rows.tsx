/**
 * THIS ENGINE'S ROW ON THE NO-AGENT FACE — the words, where core keeps the
 * shape.
 *
 * ## What it is, and what core still owns
 *
 * The panel draws one face when this machine has NO agent at all, and this is
 * this engine's line on it: how a person gets it. Core owns the list, the mark
 * beside each row and the link's element; what arrives from here is the
 * sentence and where the link goes.
 *
 * ## Why it is here rather than in `@olai/web`
 *
 * It was there: a `WHERE_FROM` record keyed by a closed `AgentId` union, three
 * engines' download pages next to each other in one core file. That cannot
 * exist now — `packages/bundle/src/fence.test.ts` holds as an equality per
 * package that no general package spells a plugin's name in code, and an engine
 * is a plugin. The rule is the right one rather than an obstacle: how a person
 * gets an engine is a fact its own package knows, and a core table of them is a
 * file edited every time an engine core has never heard of ships.
 *
 * ## THE PICKER'S ROW IS NOT HERE, and the asymmetry is the point
 *
 * The panel's *which agent?* question draws a row per installed engine, and its
 * words are this engine's `name` — which the SERVER already sends, per
 * installed agent, on the chat cell. A face for it lived here briefly and drew
 * exactly the string core would have drawn without it: one word, two authored
 * sources, nothing holding them equal. This face has no such source — the
 * machine has no agent, so there is no roster to have carried one — which is
 * what makes it a slot and the other a deletion.
 *
 * ## The sentence is spelled ONCE
 *
 * {@link ../install.ts} — the same value the server half registers as its
 * `missing` on `Agents`. Two halves, no shared graph, one string.
 */

import type { JSX } from "solid-js"

import { INSTALL } from "../install.ts"

/**
 * Where to get this engine, and the one thing to do about it.
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
