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
 * The node composer must not call one missing selection "none installed":
 * other engines may be here. It draws that engine's EngineAbsence instead,
 * and uses this face only without an engine to select.
 *
 * No mounted engine means no advice to list. Drawing an invented entry, or
 * a heading over an empty list, would be core inventing a row for a plugin
 * that is not here. The standing table, not a catalogue, decides what is owed.
 */
import { For, Show } from "solid-js"
import { useAgents } from "../agents/answered.tsx"
import { EngineAbsence } from "../agents/EngineAbsence.tsx"
import { TESTID } from "../../testids.ts"

export function NoAgent() {
  const agents = useAgents()
  const missing = () => agents.standings().filter(engine => engine.standing === "not-here")
  return <div class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 text-sm text-muted" data-testid={TESTID.chatNoAgent}>
    <p class="m-0 mb-3 text-ink">This panel has no agent.</p>
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
