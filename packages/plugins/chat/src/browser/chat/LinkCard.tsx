/**
 * A PLACE THE AGENT SENT SOMEBODY, drawn the same way wherever it arrives.
 *
 * One component because it is one thing: ACP's URL elicitation reaches the
 * panel by two routes — a conversation's own question row, and the sign-in row
 * a request-scoped one belongs to — and the card a person reads is the same
 * card either way. What differs is only who answers for it, and that is the
 * caller's business (`./AskForm.tsx` declines through the answer verbs,
 * `./SignIn.tsx` through the sign-in verb).
 *
 * THE HOST IS THE POINT, more than the link. What a person is being asked to do
 * is hand something to whoever is on the other end, and a callback URL two
 * hundred characters long does not answer "who". So the anchor's own text is the
 * machine (`chatgpt.com`, `localhost:1455`) and the whole URL is its `href`.
 *
 * A NEW TAB, `rel=noreferrer`, and never a navigation of the panel: this is
 * somebody else's page and olai is not the thing that shows it.
 */

import type { AskLink } from "@olai/acp/wire"
import { Show } from "solid-js"

import { TESTID } from "../../testids.ts"

export function LinkCard(props: {
  /** The agent's own words, which for a device-code sign-in carry the code to
   *  type into the page — the reason this is quoted rather than summarised. */
  readonly message: string
  readonly link: AskLink
  /** The agent has said the page is finished with. The card stays, because the
   *  thing a person is waiting for is the sign-in itself. */
  readonly done: boolean
}) {
  return (
    <div data-testid={TESTID.chatLink} data-host={props.link.host} data-done={props.done}>
      {/* Q. Quoted rather than rendered, like every other word an agent sends
          that a person has to read exactly: a code with an underscore in it is
          a code. */}
      <p class="m-0 whitespace-pre-wrap text-body">{props.message}</p>
      <div class="mt-2 flex items-center gap-2 text-label">
        <a
          class="rounded-control border border-accent px-2 py-1 text-accent underline underline-offset-2"
          href={props.link.url}
          target="_blank"
          rel="noreferrer"
          data-testid={TESTID.chatLinkOpen}
        >
          {props.link.host}
        </a>
        <span class="text-muted">
          <Show when={props.done} fallback={"Open this in a new tab."}>
            The agent says this is done.
          </Show>
        </span>
      </div>
    </div>
  )
}
