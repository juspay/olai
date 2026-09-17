/** No available engine is ordinary state, explained from the same standing
 * table as the picker and inspector rather than a second installation list. */
import { For, Match, Show, Switch } from "solid-js"
import type { OffBecause } from "olai-plugin-chat/wire"
import { useAgents } from "../agents/answered.tsx"
import { Missing } from "../agents/Missing.tsx"
import { TESTID } from "../../testids.ts"

export function NoAgent(props: { readonly off: OffBecause | null }) {
  const agents = useAgents()
  const missing = () => agents.standings().filter(engine => engine.standing === "not-here")
  return <div class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 text-sm text-muted" data-testid={TESTID.chatNoAgent}>
    <Switch fallback={<p class="m-0 mb-3 text-ink">This panel has no agent.</p>}>
      <Match when={props.off?.kind === "no-engine"}>
        <p class="m-0 mb-3 text-ink">This serve has no agent engine.</p>
        <p class="m-0 mb-4">Every agent olai can talk to is a plugin, and all of them are on by default.
          None is enabled here, or an engine failed to start. The plugins panel names the reason;
          enable an engine there or change its node in the configuration file.</p>
      </Match>
      <Match when={props.off?.kind === "none-installed"}>
        <p class="m-0 mb-3 text-ink">No agent is installed for this panel.</p>
        <p class="m-0 mb-4">Olai asked every engine it has and this machine has none of them.
          It looks on its own PATH — which is not your shell's, if it runs as a service;
          <code class="font-mono">OLAI_AGENT_PATH</code> is where to say so.
          After installing an agent, switch its plugin off and on to look again.</p>
      </Match>
    </Switch>
    <Show when={missing().length > 0}>
      <p class="m-0 mb-2 text-ink">Agents olai can talk to:</p>
      <ul class="m-0 mb-4 flex list-none flex-col gap-2 p-0">
        <For each={missing()}>{engine => <li>
          <Missing id={engine.id} missing={engine.missing} testid={TESTID.chatInstall} />
        </li>}</For>
      </ul>
    </Show>
    <p class="m-0">The outlines are served exactly as they would be otherwise — reading a
      directory does not need an agent. This panel is the part that does.</p>
  </div>
}
