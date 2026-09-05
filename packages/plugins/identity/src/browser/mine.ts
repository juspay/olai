/**
 * WHO THIS TAB IS, asked ONCE PER WIRE for the whole page.
 *
 * {@link ./asking.ts} is the ask; this is the arrangement that keeps it a
 * single one. `createWho()` mints a `createResource`, so every caller of it is
 * a `who.get` of its own — which was exactly right while the header chip was
 * the only reader, and is exactly wrong now that the transcript names the
 * person over every run of their messages (the chat row's `Speaker.tsx`, which
 * reads this through {@link ../person.ts}). A conversation with nine stretches
 * of somebody's own words would have asked the server nine times who they are,
 * on a value the header already had and which does not move for the life of the
 * socket (the login is read off the upgrade).
 *
 * ONE PER WIRE rather than one per PAGE, which is `./asking.ts`'s own change and
 * is named here because this is the module that says how many asks there are: a
 * redial is a new upgrade and therefore a new answer, and this row being
 * switchable is what made that reachable. The count is still one per reader-set
 * — every face shares this accessor — and the resource re-asks under them all
 * at once when the connection moves, which is exactly what keeps the chip and
 * the transcript from disagreeing.
 *
 * ## Why a module-level root rather than a context
 *
 * A provider would be the other shape and it is the wrong one here. This
 * answer has no scope: it is not per-pane, per-panel or per-conversation, it
 * is per-CONNECTION, which is the whole page — so a provider would be a
 * ceremony around a value with exactly one instance, mounted in a composition
 * root that would then have to be edited by anyone who wanted to read it. The
 * app already keeps the deployment's own name this way, for this reason
 * (`../named.ts`), and the fold reads the same: a `createRoot` at module scope
 * with the reactive value inside it.
 *
 * THE ROOT IS NEVER DISPOSED, deliberately, and the resource inside it FOLLOWS
 * THE WIRE. There is no later moment at which "who is looking" stops being a
 * question this page can be asked — including the moment this plugin is
 * switched off, when the answer is nobody and the transcript still has to be
 * told so. A dispose would only ever be a way to make the next reader re-ask,
 * and re-asking is the resource's own job now: it is keyed on the connection,
 * which is what the answer is per. `../named.ts` hands its own dispose back
 * because what it owns is an EFFECT that keeps re-considering the wire; this
 * owns a resource that reads one, which needs no teardown of its own.
 *
 * LAZY, so that importing this module does not dial. The resource fetches when
 * it is created, and creating it at module load would put a `who.get` on the
 * graph of every module that merely names this door — including the test
 * processes, which have no socket to ask down.
 */

import { createRoot } from "solid-js"

import { type Asking, createWho } from "./asking.ts"

/** The one asker, made the first time anybody wants it. */
let mine: Asking | null = null

/** Who is looking, shared. Every caller gets the same accessor over the same
 *  ask, so a face drawn nine times reads one answer nine times. */
export const whoAmI = (): Asking => (mine ??= createRoot(() => createWho()))
