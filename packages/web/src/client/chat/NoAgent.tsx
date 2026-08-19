/**
 * What the panel says when there is no agent to talk to.
 *
 * The panel DRAWS in this state rather than disappearing, and that is the whole
 * point of this component. A feature that is silently absent is one a reader
 * cannot tell from a feature that is broken, or from one they have not found
 * yet — so the drawer opens, and it says which variable would give it an agent.
 *
 * It is not an error. Serving a directory has never depended on an agent being
 * installed, and nothing else on the page is affected; this is a capability
 * that is switched off, explained where somebody went looking for it.
 */

import { TESTID } from "../testids.ts"

/** The variable, spelled the way the server spells it (`chat/adapter.ts`). One
 *  string in two packages that never import each other — but it is a NAME a
 *  person types, not a contract two ends agree on, and the message is worth
 *  nothing if it does not print it. */
const AGENT_ENV = "OLAI_ACP_AGENT"

export function NoAgent() {
  return (
    <div
      class="olai-scroll flex-1 overflow-y-auto px-4 py-6 text-sm text-muted"
      data-testid={TESTID.chatNoAgent}
    >
      <p class="m-0 mb-3 text-ink">No ACP agent is configured.</p>

      <p class="m-0 mb-3">
        The outlines are served exactly as they would be otherwise — reading a
        directory does not need an agent. This panel is the part that does.
      </p>

      <p class="m-0 mb-1">
        Every documented way of starting olai — <code class="font-mono">nix run</code>,
        the packaged binary, <code class="font-mono">just serve</code> — comes with
        the pinned Claude Code adapter, so seeing this usually means one of two
        things:
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
        speaks the Agent Client Protocol on stdio, and reload.
      </p>
    </div>
  )
}
