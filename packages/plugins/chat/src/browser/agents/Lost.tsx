/**
 * WHAT A CHAT PAGE SAYS WHEN ITS NOTE HAS GONE, or has stopped naming the
 * conversation that is open on it — the two faces of `./lost.ts`, drawn where
 * the door would be.
 *
 * Both of them replace the *Ask about <name>…* box, and that is the whole
 * point: a door is an offer to START something, and neither of these pages is
 * one. A note that is not there cannot be chatted about, and a note whose
 * conversation is still running does not want a second one.
 *
 * THE CONVERSATION IS NEVER SAID TO HAVE ENDED, because it has not. A serve
 * holds a conversation by its own id and not by the tie — a revision only
 * re-reads which item names which — so the answer in flight goes on arriving
 * and the session is still there. What is lost is the NAME, and the untied
 * face is the one press that gives it back (`conversation.retie`).
 *
 * WHAT IS NOT DRAWN HERE is the conversation itself. A chat is drawn where
 * its item names it; a page drawing a transcript the vault no longer ties to
 * anything would be a fourth place a conversation can live, reachable only by
 * having been open at the moment the tie went. So the page says what
 * happened, in the place the transcript was, and offers the way back where
 * there is one.
 */

import { Result } from "effect"
import { createSignal, Show } from "solid-js"
import { itemKey } from "@olai/format"
import { runAsync } from "@olai/web/client/run.ts"

import { TESTID } from "../../testids.ts"
import { chatWire } from "../wire.ts"
import type { Lost } from "./lost.ts"

const SAID = "mt-6 rounded-control border border-dashed border-rule bg-desk/40 p-3 text-body leading-relaxed text-muted"

export function LostNote(props: { readonly lost: Lost; readonly name: string }) {
  return (
    <Show when={props.lost.kind === "untied" ? props.lost : undefined} fallback={<Gone name={props.name} />}>
      {(untied) => <Untied at={untied()} name={props.name} />}
    </Show>
  )
}

/** THE NOTE IS NOT THERE — renamed or deleted on disk. No start is offered:
 *  there is nothing to write a chat onto. A RENAME keeps the note's own front
 *  matter, so that conversation is alive at the new path's page; this address
 *  is the old one, and says so. */
function Gone(props: { readonly name: string }) {
  return (
    <section class={SAID} data-testid={TESTID.chatPageGone} role="status">
      <p>
        This note is gone — olai no longer holds it, so there is no chat to open here.
        If you renamed it, its chat went with the file: open the note at its new name.
      </p>
    </section>
  )
}

/** THE NOTE IS THERE AND HAS STOPPED NAMING THIS CONVERSATION — its front
 *  matter lost the tie while the page was open, which is a thing a tool
 *  outside olai can do and no fence of ours can prevent. One press writes it
 *  back. */
function Untied(props: { readonly at: Extract<Lost, { kind: "untied" }>; readonly name: string }) {
  const [problem, setProblem] = createSignal<string>()
  const [pressing, setPressing] = createSignal(false)
  const press = async () => {
    if (pressing()) return
    setPressing(true)
    setProblem(undefined)
    try {
      const outcome = await runAsync(chatWire().procedures.conversation.retie({
        node: itemKey({ kind: "note", path: props.at.path }),
        agent: props.at.was.agent,
        session: props.at.was.session,
      }))
      if (Result.isFailure(outcome)) setProblem(outcome.failure.message)
    } finally { setPressing(false) }
  }
  return (
    <section class={SAID} data-testid={TESTID.chatPageUntied} role="status">
      <p>
        <strong class="font-semibold text-ink">{props.name}</strong> no longer names this conversation —
        the tie has gone from the note's front matter. The conversation itself is untouched.
      </p>
      <p class="mt-2">
        <button
          type="button"
          class="rounded-control border border-rule px-2 py-1 text-body text-ink hover:bg-desk"
          data-testid={TESTID.chatRetie}
          disabled={pressing()}
          onClick={() => void press()}
        >Tie it to {props.name} again</button>
        <Show when={problem()}><span role="alert" class="ml-2 text-alarm">{problem()}</span></Show>
      </p>
    </section>
  )
}
