/**
 * An MCP server this conversation was meant to have, and does not.
 *
 * The visible half of `mcp-fail-visible`. A server that failed to attach used
 * to leave a debug log line and a session quietly short of its tools: the panel
 * drew a perfectly healthy conversation, the agent could not see kolu's
 * terminals, and the way to find out which of those was true was to read olai's
 * log from outside the app. The whole of this component is that the two are
 * told apart on screen.
 *
 * Three arguments about how it is drawn, and each is a thing it deliberately is
 * not:
 *
 *   - **it is not an alarm.** Nothing is broken: the conversation works, the
 *     outlines are served, and the agent will answer — it simply has fewer
 *     tools than it might have. So this takes the panel's quiet vocabulary
 *     (`panel` under a `desk`, the header's own 11px mono, muted prose) and one
 *     `alarm` dot, which is the smallest mark this palette has for "something
 *     to look at". A red banner would teach a reader to close the drawer.
 *   - **it is not folded.** The REASON is the feature — "kolu did not attach"
 *     is the sentence every failure shares and the one that never helped
 *     anybody — so hiding it behind a disclosure would ship the log line again,
 *     one click further away. It is two short lines, on a panel nobody sees
 *     unless something actually failed.
 *   - **it is not in the transcript.** This is a standing property of the
 *     session, like the model in the header above it, and not something that
 *     happened at a point in the conversation. A notice row would scroll out of
 *     reach under the first answer — which is where the reader is when they
 *     wonder why the terminals are missing.
 *
 * A healthy session renders NOTHING here, and that is not an accident of an
 * empty list: `missing` is empty on every conversation that got what it was
 * meant to, and a host that is not running kolu at all reports no absence
 * either (`../../../../chat/src/kolu.ts` — nothing failed, so nothing is said).
 */

import type { MissingServer } from "@olai/surface"
import { For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import type { Chat } from "./state.ts"

export function Missing(props: { readonly chat: Chat }) {
  const missing = () => props.chat.state().missing

  return (
    <Show when={missing().length > 0}>
      <section
        class="shrink-0 border-b border-rule/70 bg-panel px-3 py-1.5"
        data-testid={TESTID.chatMissing}
        aria-label="missing tools"
      >
        <For each={missing()}>{(server) => <Server server={server} />}</For>
      </section>
    </Show>
  )
}

/** One of them: what is not here, why not, and — when the probe had one — which
 *  file it asked. */
function Server(props: { readonly server: MissingServer }) {
  return (
    <div
      class="font-mono text-[0.6875rem] leading-snug"
      data-testid={TESTID.chatMissingServer}
      data-server={props.server.name}
    >
      <p class="flex items-baseline gap-1.5 text-ink">
        <span
          class="inline-block size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-alarm"
          aria-hidden="true"
        />
        <span>
          <span class="font-semibold">{props.server.name}</span>{" "}
          is missing from this conversation
        </span>
      </p>
      {/* The server's own words, and the reason this strip is worth its
          pixels. `break-words` because a reason can carry a socket path or an
          errno string, and a 26rem drawer is not wide enough to be trusted
          with one. */}
      <p class="break-words pl-3 text-muted" data-testid={TESTID.chatMissingWhy}>
        {props.server.why}
      </p>
      {/* WHICH file was asked. The incident this whole feature comes from was
          exactly this question: a `kolu` on PATH is not necessarily the host's
          kolu, and a padi-spawned terminal prepends its own bundled copy. */}
      <Show when={props.server.where}>
        {(where) => <p class="truncate pl-3 text-muted/70" title={where()}>{where()}</p>}
      </Show>
    </div>
  )
}
