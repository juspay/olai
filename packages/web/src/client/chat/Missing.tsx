/**
 * The servers this conversation does NOT have, in sentences — the whole of
 * `mcp-fail-visible`, drawn under {@link ./Roster.tsx}'s list of the ones it
 * does.
 *
 * A server that failed to attach used to leave a debug log line and a session
 * quietly short of its tools: the panel drew a perfectly healthy conversation,
 * the agent could not see kolu's terminals, and the way to find out which of
 * those was true was to read olai's log from outside the app. The whole of this
 * component is that the two are told apart on screen.
 *
 * ITS OWN COMPONENT, still, now that the roster names the healthy servers as
 * well. The two answer two questions — *which servers are here* and *why is one
 * of them not* — and they change for different reasons: a fifth standing moves
 * the chips, a reworded probe moves these. A conversation that got everything
 * answers only the first, so this is a component that is absent rather than a
 * branch inside that one, and its testid is what a scenario asserts the absence
 * of.
 *
 * The REASON is the feature — "kolu did not attach" is the sentence every
 * failure shares and the one that never helped anybody — so it is not folded
 * behind a disclosure, which would ship the log line again one click further
 * away. Two short lines per server, on rows nobody sees unless something
 * actually failed.
 *
 * TWO STANDINGS reach here and the sentence is what tells them apart
 * ({@link ./standing.ts}): olai's own probe refused to hand the server over
 * (`missing`), or olai handed it over and the AGENT could not attach it
 * (`unattached`) — which is a fact olai could not report at all until
 * `mcp-roster-visible`, because ACP's `session/new` says nothing per server.
 * They want different things done about them, which is why the words differ.
 */

import { type ChatServer, whyNot } from "@olai/surface"
import { For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { SAID } from "./standing.ts"

export function Missing(props: { readonly servers: ReadonlyArray<ChatServer> }) {
  return (
    <Show when={props.servers.length > 0}>
      <div class="mt-1 space-y-1" data-testid={TESTID.chatMissing}>
        <For each={props.servers}>{(server) => <Row server={server} />}</For>
      </div>
    </Show>
  )
}

/** One of them: what is not here, why not, and — when there was one — which
 *  file was asked. */
function Row(props: { readonly server: ChatServer }) {
  return (
    <div data-testid={TESTID.chatMissingServer} data-server={props.server.name}>
      <p class="flex items-baseline gap-1.5 text-ink">
        <span
          class="inline-block size-1.5 shrink-0 -translate-y-px rounded-full bg-alarm"
          aria-hidden="true"
        />
        <span>
          <span class="font-semibold">{props.server.name}</span>{" "}
          {SAID[props.server.standing.kind].sentence}
        </span>
      </p>
      {/* The server's own words, and the reason this strip is worth its
          pixels. `break-words` because a reason can carry a socket path or an
          errno string, and a 26rem drawer is not wide enough to be trusted
          with one. */}
      <p class="break-words pl-3 text-muted" data-testid={TESTID.chatMissingWhy}>
        {whyNot(props.server)}
      </p>
      {/* WHICH file was asked. The incident this whole feature comes from was
          exactly this question: a `kolu` on PATH is not necessarily the host's
          kolu, and a padi-spawned terminal prepends its own bundled copy. It
          truncates and keeps the whole of it on the `title`, because a store
          path is longer than this drawer and the tail of one is the half that
          identifies it.

          Absent for the one failure that never reached a file, where the
          reason above is the whole of it — an empty line under it would be
          this panel implying a path it does not have. */}
      <Show when={props.server.where}>
        {(where) => (
          <p class="truncate pl-3 text-muted/70" title={where()}>{where()}</p>
        )}
      </Show>
    </div>
  )
}
