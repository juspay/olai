/**
 * What the panel says when this machine has NO agent to talk to — and how to
 * get one.
 *
 * The panel DRAWS in this state rather than disappearing, and that is the whole
 * point of this component. A feature that is silently absent is one a reader
 * cannot tell from a feature that is broken, or from one they have not found
 * yet — so the drawer opens, and it says what would fill it.
 *
 * THE INSTALL INSTRUCTIONS ARE THE RULING (2026-08-21): an empty roster shows
 * how to install an agent, not an empty list. Which is to say this face answers
 * the question a person actually has — *what do I do about it* — rather than
 * only the one the old copy answered, which was *what happened*.
 *
 * It is not an error. Serving a directory has never depended on an agent being
 * installed, and nothing else on the page is affected; this is a capability
 * that is switched off, or one nobody has installed yet, explained where
 * somebody went looking for it.
 */

import { For } from "solid-js"

import { AGENTS, type AgentId } from "@olai/surface"

import { TESTID } from "../testids.ts"
import { AgentMark } from "./AgentMark.tsx"

/** The variable, spelled the way the server spells it (`chat/adapter.ts`). One
 *  string in two packages that never import each other — but it is a NAME a
 *  person types, not a contract two ends agree on, and the message is worth
 *  nothing if it does not print it. */
const AGENT_ENV = "OLAI_ACP_AGENT"

/**
 * Where a person GETS each agent olai knows how to talk to.
 *
 * Only the half neither end could answer for the other: the server says which
 * agents are installed and this face is drawn precisely when the answer was
 * NONE, so there is nothing on the wire to draw from — and a URL and a sentence
 * are drawing rather than facts about a machine.
 *
 * KEYED BY `AgentId`, which is what stops it drifting. The ids and the NAMES
 * are the wire's own table (`@olai/surface`'s `AGENTS`, which says why it lives
 * there), so this record is exhaustive by the type checker: a third agent added
 * to the roster stops this file compiling rather than quietly not being
 * mentioned in the one face that explains agents.
 */
const WHERE_FROM: { readonly [K in AgentId]: { readonly how: string; readonly where: string } } = {
  claude: {
    how: "comes with olai — every documented way of starting it bakes the adapter in",
    where: "https://claude.com/claude-code",
  },
  opencode: {
    how: "put `opencode` on this server's PATH",
    where: "https://opencode.ai",
  },
}

/** ... and the rows to draw, in the table's own order. */
const KNOWN = (Object.keys(WHERE_FROM) as ReadonlyArray<AgentId>).map((id) => ({
  id,
  name: AGENTS[id].name,
  ...WHERE_FROM[id],
}))

export function NoAgent() {
  return (
    <div
      class="olai-scroll flex-1 overflow-y-auto px-4 py-6 text-sm text-muted"
      data-testid={TESTID.chatNoAgent}
    >
      <p class="m-0 mb-3 text-ink">No agent is installed for this panel.</p>

      <p class="m-0 mb-4">
        The outlines are served exactly as they would be otherwise — reading a
        directory does not need an agent. This panel is the part that does.
      </p>

      <p class="m-0 mb-2 text-ink">Agents olai can talk to:</p>
      <ul class="m-0 mb-4 flex list-none flex-col gap-2 p-0">
        <For each={KNOWN}>
          {(agent) => (
            <li
              class="flex items-start gap-2"
              data-testid={TESTID.chatInstall}
              data-agent={agent.id}
            >
              <span class="mt-0.5">
                <AgentMark id={agent.id} />
              </span>
              <span class="min-w-0">
                <a
                  class="text-ink underline underline-offset-2"
                  href={agent.where}
                  target="_blank"
                  rel="noreferrer"
                >
                  {agent.name}
                </a>
                <span> — {agent.how}</span>
              </span>
            </li>
          )}
        </For>
      </ul>

      <p class="m-0 mb-1">
        Seeing this with Claude Code installed usually means one of two things:
      </p>

      <ul class="m-0 mb-3 list-disc pl-5">
        <li>
          <code class="font-mono">{AGENT_ENV}</code> is set to the empty string,
          which is the explicit way to turn chat off;
        </li>
        <li>
          olai was started by hand, without the wrapper that bakes the adapter in.
        </li>
      </ul>

      <p class="m-0">
        Point <code class="font-mono">{AGENT_ENV}</code> at an executable that
        speaks the Agent Client Protocol on stdio, and reload. Olai looks for the
        others on its own PATH — which is not your shell's, if it runs as a
        service; <code class="font-mono">OLAI_AGENT_PATH</code> is where to say
        so.
      </p>
    </div>
  )
}
