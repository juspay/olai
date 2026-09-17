/**
 * What the panel says when this machine has no agent to talk to — and how to
 * get one.
 *
 * The panel draws in this state rather than disappearing. A feature that is
 * silently absent cannot be told from one that is broken, or one a reader has
 * not found yet. An empty conversation needs advice, not merely an empty list.
 * Serving the directory does not depend on an agent, so this is ordinary
 * capability state, not an error that should take the rest of the page away.
 *
 * ## The sentence belongs to the engine; the drawing belongs to chat
 *
 * An engine knows which prerequisite its probe could not find. It supplies
 * a whole NotHere, not a noun for this component to drop into a template.
 * Chat composes no clause of that reason. Conversely, the list, the mark's
 * box, and whether a name is a link are facts about this face, not five engine
 * packages' copies of the same Tailwind markup. EngineAbsence owns that line
 * once, shared with the inspector and the disabled picker choice.
 *
 * The rows come from the server's whole standing table, not from browser
 * registration or a compiled-in catalogue of engines. A serve that did not
 * mount an engine has no probe result for it and no advice to list here.
 * A missing browser chunk cannot erase a machine diagnosis the server made.
 *
 * ## Absence has a subject
 *
 * No enabled engine and no installed executable need different remedies.
 * When the caller has the server's OffBecause decision, it supplies it; null
 * means this face has no global verdict to announce, not permission to guess.
 * The node composer must not call one missing selection "none installed":
 * other engines may be here. That composer draws the selected engine's own
 * EngineAbsence instead, and uses this face only without an engine to select.
 *
 * Even without a global verdict, the missing rows give actionable advice.
 * The heading names engines this machine has not got, and an empty table draws
 * neither invented rows nor a heading over nothing.
 */
import { For, Match, Show, Switch } from "solid-js"
import type { OffBecause } from "olai-plugin-chat/wire"
import { useAgents } from "../agents/answered.tsx"
import { EngineAbsence } from "../agents/EngineAbsence.tsx"
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
      <p class="m-0 mb-2 text-ink">Enabled engines this machine has not got:</p>
      <ul class="m-0 mb-4 flex list-none flex-col gap-2 p-0">
        <For each={missing()}>{engine => <li>
          <EngineAbsence id={engine.id} missing={engine.missing} testid={TESTID.chatInstall} />
        </li>}</For>
      </ul>
    </Show>
    <p class="m-0">The outlines are served exactly as they would be otherwise — reading a
      directory does not need an agent. This panel is the part that does.</p>
  </div>
}
