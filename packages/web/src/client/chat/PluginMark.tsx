/**
 * WHICH PLUGIN, as a mark — the third face in the transcript's column.
 *
 * {@link ./AgentMark.tsx}'s job for the other kind of machine, and its
 * reasoning holds word for word: the question "who is talking" is one a person
 * answers by LOOKING rather than by reading, several times a conversation, and
 * a name alone is enough to read and not enough to glance at.
 *
 * ## What is different, and it is the whole point of this file
 *
 * The agent marks are BUNDLED and OURS — drawn in that file, in a few SVG
 * shapes, against a roster olai ships. A plugin's is not olai's to draw.
 * `@olai/plugin-api`'s `fence.test.ts` holds as an equality per package that no
 * general package spells a plugin's name in code, so the table an agent's mark
 * is looked up in cannot exist here — and that fence is the right rule rather
 * than an obstacle: what a tenant looks like is a decision made where somebody
 * knows what the tenant IS. So the shapes arrive on the plugin's own manifest
 * ({@link ../plugins/marks.ts}, over `@olai/plugin-api`'s `PluginMark`) and this
 * component draws whatever came back.
 *
 * What core keeps is the ELEMENT — the box, the size, `aria-hidden` — because
 * those are facts about the column the mark is read in rather than about the
 * plugin. A tenant that could pick its own size could make its row look unlike
 * every row around it, which is a request the panel should refuse.
 *
 * ## The generic is core's, and is not a failure
 *
 * A plugin that hangs no mark, and a `rang` name no manifest in this build
 * answers to (a conversation rung by a plugin a later build dropped), are drawn
 * as a plain plugin and NAMED in full beside it — the same bargain every other
 * unknown in this panel gets. What it must never do is borrow another plugin's
 * shape: a reader who learns "the panes mean kolu" would be told something
 * false the first time a third tenant arrived.
 *
 * `data-mark` says which shape was drawn, so a scenario can assert that the
 * generic turns up exactly where it should rather than reading a path out of
 * the DOM. That attribute carries the plugin's name as DATA — the same string
 * the server already stamped on the row (`data-rang-by`) — which is what core
 * is allowed to know about a tenant and the whole of it.
 */

import type { JSX } from "solid-js"
import { Dynamic } from "solid-js/web"

import { markOf } from "../plugins/marks.ts"
import { TESTID } from "../testids.ts"
import { MARK } from "./AgentMark.tsx"

/** A plugin olai has no shape for: a plain square frame with a plug of a stem
 *  on it — present, distinct from the agents' ring-and-dot generic, and
 *  claiming nothing about whose it is. */
const GenericMark = (): JSX.Element => (
  <g stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round">
    <rect x="2.6" y="5.2" width="10.8" height="8.4" rx="1.4" />
    <line x1="5.6" y1="5.2" x2="5.6" y2="2.4" />
    <line x1="10.4" y1="5.2" x2="10.4" y2="2.4" />
  </g>
)

/** The mark for one plugin, by the name core stamped on the row it spoke in. */
export function PluginMark(props: { readonly name: string }) {
  const own = () => markOf(props.name)
  return (
    <svg
      viewBox="0 0 16 16"
      class={MARK}
      aria-hidden="true"
      data-testid={TESTID.chatPluginMark}
      data-mark={own() === undefined ? "generic" : props.name}
    >
      <Dynamic component={own() ?? GenericMark} />
    </svg>
  )
}
