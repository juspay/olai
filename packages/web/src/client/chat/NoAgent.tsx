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
 *
 * ## THE ROWS ARE THE ENGINES' OWN FACES, and that is the phase
 *
 * There was a `WHERE_FROM` record here, keyed by a closed `AgentId` union
 * exported from `@olai/surface`, holding a sentence and a URL for each of the
 * three engines olai shipped — the other half of a table that package carried
 * for the names. Both are gone: an engine is a PLUGIN, and
 * `packages/bundle/src/fence.test.ts` holds as an equality per package that no
 * general package spells one in code.
 *
 * So each row is a face the engine's own browser half hung in
 * `chat.agent.install` ({@link ../plugins/agents.ts}), and this file draws the
 * LIST — the item, the mark, the testid a scenario reads. The sentence inside is
 * the plugin's whole words, the same string its server half registers as its
 * `missing`, spelled once in that plugin's package.
 *
 * IT IS STRICTLY MORE HONEST THAN THE TABLE it replaces, and the reason is the
 * tab following the roster: this list is the engines this SERVE composed, not
 * the engines this BUILD has. A serve started `--plugins=opencode,pi` never
 * fetches the Claude chunk, so no Claude row is drawn — where a compiled-in
 * record would have gone on offering an engine this serve could not mount, with
 * nothing in core knowing why.
 */

import { Dynamic } from "solid-js/web"
import { For, Show } from "solid-js"

import { installs } from "../plugins/agents.ts"
import { TESTID } from "../testids.ts"
import { AgentMark } from "./AgentMark.tsx"

/** The variable, spelled the way the server spells it (`@olai/acp/engine`). One
 *  string in two packages that never import each other — but it is a NAME a
 *  person types, not a contract two ends agree on, and the message is worth
 *  nothing if it does not print it. */
const AGENT_ENV = "OLAI_ACP_AGENT"

export function NoAgent() {
  const known = () => installs()
  return (
    <div
      class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 text-sm text-muted"
      data-testid={TESTID.chatNoAgent}
    >
      <p class="m-0 mb-3 text-ink">No agent is installed for this panel.</p>

      <p class="m-0 mb-4">
        The outlines are served exactly as they would be otherwise — reading a
        directory does not need an agent. This panel is the part that does.
      </p>

      {/* NOTHING AT ALL IS A STATE, and it is the one `--plugins=` with no
          engine row named composes to: this serve has no engine to offer, so
          there is nothing to list and the paragraph that would have introduced
          the list is not drawn either. */}
      <Show when={known().length > 0}>
        <p class="m-0 mb-2 text-ink">Agents olai can talk to:</p>
        <ul class="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          <For each={known()}>
            {(engine) => (
              <li
                class="flex items-start gap-2"
                data-testid={TESTID.chatInstall}
                data-agent={engine.plugin}
              >
                <span class="mt-0.5">
                  <AgentMark id={engine.plugin} />
                </span>
                <span class="min-w-0">
                  <Dynamic component={engine.face} />
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <p class="m-0 mb-1">
        Seeing this with an agent installed usually means one of two things:
      </p>

      <ul class="m-0 mb-3 list-disc pl-5">
        <li>
          <code class="font-mono">{AGENT_ENV}</code> is set to the empty string,
          which is the explicit way to turn chat off;
        </li>
        <li>
          olai was started by hand, without the wrapper that bakes the pinned
          adapters in.
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
