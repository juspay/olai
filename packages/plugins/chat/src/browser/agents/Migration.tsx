/**
 * WHAT THIS VAULT IS OWED to get its node agents back — the sentence, and the
 * row that ends it.
 *
 * ## Why this is a face and not a finding
 *
 * It was a validator finding (`@olai/format`'s `legacy-key`, now deleted), and
 * the cost of that was the objection this file answers: by the error model a
 * finding BREAKS the file it is filed on, and the only honest file for this one
 * is the declarations page — so a release shipping the notice put every vault
 * carrying a pre-migration binding into errors-only on the ONE file every
 * declared kind depends on, and refused every other write to it until somebody
 * pasted the row. A notice that darkens the page it is asking you to edit costs
 * more than the thing it is about.
 *
 * Nothing about it was general, either: `ContributedKind.wasCalled` had one
 * writer and one reader in the tree and both were this key. The kind is this
 * plugin's, the retired spelling is this plugin's, the composed word to paste is
 * this plugin's claim — so the sentence is this plugin's too, and saying it here
 * costs the vault nothing. No finding, no broken file, no refused write.
 *
 * ## Where it is drawn is why it needs no alarm
 *
 * At the head of the agents section, which is EMPTY exactly when this is owed:
 * the roster is the query over the DECLARED key, so a board whose key nothing
 * declares has no node agents to list. A person who went looking for an agent
 * that stopped appearing finds the reason in the place they went looking, which
 * is the useful half of what the validator's sentence was for.
 *
 * ## The row is the whole of the fix and is SELECTABLE
 *
 * `select-all` on the code, so one click takes it: what a person does with this
 * is paste it, and a notice that made them sweep six lines of JSON by hand
 * would be a notice that told them what to do and then made it hard.
 */

import { Show } from "solid-js"

import { REGION_LABEL } from "@olai/web/client/layout/entry.ts"
import type { Migration } from "olai-plugin-chat/wire"
import { TESTID } from "../../testids.ts"

/** The row a person pastes, composed from the words the server sent rather than
 *  from anything spelled here — a rename cannot leave this naming a kind nobody
 *  registers, because neither half is a literal on this page. */
const rowFor = (owed: Migration): string =>
  JSON.stringify({
    id: `prop-${owed.key}`,
    ord: "a0",
    title: owed.key,
    custom: { type: owed.kind },
  })

/** How the records are named: a few, and then how many more — the cap said out
 *  loud, because a truncation a reader cannot see is a count they will not
 *  trust against their own board. */
const held = (owed: Migration): string =>
  owed.more === 0
    ? owed.holding.join(", ")
    : `${owed.holding.join(", ")} and ${owed.more} more`

export function MigrationNotice(props: { readonly owed: Migration }) {
  return (
    <div class="mb-2" data-testid={TESTID.agentMigration}>
      <h2 class={REGION_LABEL}>Agents</h2>
      <p class="m-0 px-2 py-1 text-[0.6875rem] leading-snug text-muted">
        {/* WHAT IS TRUE, WHY, AND WHAT TO DO — in that order, and the first
            clause is the one a person came for: their agents are not gone, the
            column just cannot see them. */}
        This board has {props.owed.holding.length + props.owed.more}{" "}
        {props.owed.holding.length + props.owed.more === 1 ? "record" : "records"}{" "}
        holding <code>{props.owed.key}</code> — {held(props.owed)}. It is the kind{" "}
        <code>{props.owed.kind}</code>{" "}
        now, and a plugin may only ever declare a key carrying its own name, so olai
        will not take this one over. One row in <code>{props.owed.at}</code>{" "}
        moves it, and the agents come back:
      </p>
      <pre
        class="m-0 overflow-x-auto rounded border border-rule/70 bg-paper/5 px-2 py-1 text-[0.625rem] leading-snug select-all"
        data-testid={TESTID.agentMigrationRow}
      >{rowFor(props.owed)}</pre>
      <p class="m-0 px-2 py-1 text-[0.6875rem] leading-snug text-muted">
        {/* THE OTHER ANSWER, said because it is a real one: a board that never
            meant these as bindings should be able to say so and stop hearing
            about it. */}
        Declaring it <code>text</code> instead says the key is prose, and stops this
        being said.
      </p>
    </div>
  )
}

/** Drawn only where one is owed — which is the state every vault leaves and none
 *  returns to, so nearly every serve renders nothing at all here. */
export function Migrating(props: { readonly owed: Migration | null }) {
  return <Show when={props.owed}>{(owed) => <MigrationNotice owed={owed()} />}</Show>
}
