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
 * So each row is a SENTENCE the engine's own browser half hung in
 * `engine.install` ({@link ../installs.ts}) — a `NotHere`, and the one
 * slot on the table that carries a value rather than a drawing. This file draws
 * every stroke: the item, the mark, the testid a scenario reads, and whether the
 * name is an anchor or plain text. What arrives is the words, spelled once in
 * that plugin's own `install.ts`.
 *
 * IT WAS A FACE for one revision, and what that bought was core's own Tailwind
 * vocabulary (`text-ink underline underline-offset-2`) living in three tenant
 * packages, in three byte-identical files, one restyle away from drifting — and
 * a fourth engine copying markup in order to say one sentence.
 *
 * IT IS STRICTLY MORE HONEST THAN THE TABLE it replaces, and the reason is the
 * tab following the roster: this list is the engines this SERVE composed, not
 * the engines this BUILD has. A serve started `--plugins=opencode,pi` never
 * fetches the Claude chunk, so no Claude row is drawn — where a compiled-in
 * record would have gone on offering an engine this serve could not mount, with
 * nothing in core knowing why.
 *
 * ## IT SAYS WHICH, and it used to GUESS
 *
 * This face read one empty array and hedged: *"seeing this with an agent
 * installed usually means one of two things"*, then two bullets. One of them —
 * a start that did not go through the wrapper that bakes the pinned adapters in
 * — cannot happen on any documented way of starting olai, since every one of
 * them bakes it in. And the case that DOES happen most, a `--plugins` list
 * naming no engine row, was the one the face never mentioned: a person who
 * turned every engine off was told to point `OLAI_ACP_AGENT` at an executable,
 * which would have changed nothing, because with no engine plugin mounted there
 * is nobody left to read that variable.
 *
 * The server knows which of the three it is — it reads the off switch before it
 * probes, it holds the engine registry, and it holds what the probes said — and
 * it now sends it (`@olai/surface`'s {@link OffBecause}, minted in `olai-plugin-chat`'s
 * `agents/roster.ts`, the same value the journal line is made from). So the
 * opening sentence is ONE arm, saying what happened and what to do about it, and
 * asserts nothing about the other two.
 *
 * THE LIST STAYS UNDER ALL OF THEM, which is the human's ruling of 2026-08-21
 * unchanged: an empty roster shows how to get an agent rather than an empty
 * list, and *which agents olai can talk to* is a true and useful thing to read
 * whichever of the three brought somebody here. It is the GUESSING that went,
 * not the answer.
 */

import { For, Match, Show, Switch } from "solid-js"

import type { OffBecause } from "olai-plugin-chat/wire"
import { installs } from "../installs.ts"
import { TESTID } from "../../testids.ts"
import { AgentMark } from "./AgentMark.tsx"

/** The variable, spelled the way the server spells it (`@olai/acp/engine`). One
 *  string in two packages that never import each other — but it is a NAME a
 *  person types, not a contract two ends agree on, and the message is worth
 *  nothing if it does not print it. */
const AGENT_ENV = "OLAI_ACP_AGENT"

export function NoAgent(props: { readonly off: OffBecause | null }) {
  const known = () => installs()
  return (
    <div
      class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 text-sm text-muted"
      data-testid={TESTID.chatNoAgent}
    >
      {/* THE OPENING SENTENCE IS THE ARM, and there is exactly one of it. What
          the three have in common — the outlines are served either way — is
          said once, below. */}
      <Switch
        fallback={
          /* THE SERVER HAS NOT SAID YET: the value a page holds before the
             first frame lands (`CHAT_OFF`). Not one of the three, so this
             claims none of them. */
          <p class="m-0 mb-3 text-ink">This panel has no agent.</p>
        }
      >
        <Match when={props.off?.kind === "switched-off"}>
          <p class="m-0 mb-3 text-ink">Chat is switched off.</p>
          <p class="m-0 mb-4">
            <code class="font-mono">{AGENT_ENV}</code> is set to the empty
            string, which is the explicit way to say so. Unset it and reload,
            and this panel comes back with whatever this machine has.
          </p>
        </Match>

        <Match when={props.off?.kind === "no-engine"}>
          <p class="m-0 mb-3 text-ink">This serve has no agent engine.</p>
          <p class="m-0 mb-4">
            Every agent olai can talk to is a plugin, and all of them are on by
            default — so this is a{" "}
            <code class="font-mono">--plugins</code> list that named none of
            them, or an engine whose plugin failed to start (the plugins
            preferences say which). Drop the flag, or add an engine's word to
            it.
          </p>
        </Match>

        <Match when={props.off?.kind === "none-installed"}>
          <p class="m-0 mb-3 text-ink">
            No agent is installed for this panel.
          </p>
          <p class="m-0 mb-4">
            Olai asked every engine it has and this machine has none of them.
            It looks on its own PATH — which is not your shell's, if it runs as
            a service; <code class="font-mono">OLAI_AGENT_PATH</code> is where
            to say so. You can also point{" "}
            <code class="font-mono">{AGENT_ENV}</code> at any executable that
            speaks the Agent Client Protocol on stdio.
          </p>
        </Match>
      </Switch>

      {/* WHAT OLAI CAN TALK TO, under whichever sentence applies. Each row is
          the engine's own, out of the slot its browser half hung it in
          ({@link ../installs.ts}) — so this is the engines this SERVE
          composed rather than the engines this BUILD has.

          EMPTY IS A STATE and it is mostly the `no-engine` arm's: a serve that
          mounted no engine has none to list, and the heading that would
          introduce the list is not drawn either. It can also be empty with
          engines mounted, where a browser chunk did not arrive — the same
          silence, honestly drawn. */}
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
                  {/* A LINK ONLY WHERE THERE IS A PLACE. `where` is `null` for
                      an engine that names none, and a dead anchor around a name
                      is worse than the plain name. The arm is HERE, in core,
                      because which element a name is drawn as is a fact about
                      this list rather than about the engine — what the plugin
                      answers is whether there is somewhere to point at. */}
                  <Show
                    when={engine.face.where}
                    fallback={<span class="text-ink">{engine.face.name}</span>}
                  >
                    {(where) => (
                      <a
                        class="text-ink underline underline-offset-2"
                        href={where()}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {engine.face.name}
                      </a>
                    )}
                  </Show>
                  {/* THE SENTENCE, VERBATIM. Core displays one and composes no
                      clause of it — there is no template here with a plugin's
                      noun dropped in, which is the shape that reads as a debug
                      log line on a screen. */}
                  <span>{` — ${engine.face.why}`}</span>
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <p class="m-0">
        The outlines are served exactly as they would be otherwise — reading a
        directory does not need an agent. This panel is the part that does.
      </p>
    </div>
  )
}
