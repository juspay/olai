/**
 * The conversation, as this tab sees it.
 *
 * Two subscriptions, and every verb that CHANGES anything is a surface member —
 * there is no chat state in the browser that the server does not own. What was
 * typed, what the agent said, which tool ran, which session this is: all of it
 * arrives as frames, so two tabs cannot disagree and a reload is a fresh read
 * rather than a replay protocol.
 *
 * The one exception proves the rule: {@link Chat.refused} is this tab's, and
 * always was — it is what the last thing a person did came back with, which is
 * about a click rather than about the conversation. {@link Chat.refuse} writes
 * that line for a caller with something to say that no round trip produced.
 *
 * The transcript is a COLLECTION served with batched deltas, which is why a tab
 * opened halfway through a turn shows the whole conversation: its first frame is
 * the snapshot. Rows are sorted by their own `seq` rather than by the order the
 * keys arrived, because arrival order is a delivery detail and the conversation
 * has an order of its own — and that sort is a FOLD over the frames rather than
 * a pass over the whole transcript per frame ({@link ./order.ts}).
 *
 * **`rows` is KEYS, and each row reads its own value.** `<For>` diffs its list
 * by identity, so what is IN that list decides whether a change patches a row
 * or replaces it — and a row replaced is every piece of state it owns thrown
 * away while the reader is looking at it: an unfolded tool call, a text
 * selection, a scroll position. Strings, compared with `===`, cannot be
 * anything but the same list; the value comes from `entry(key)` inside the row,
 * where a change is a read that re-ran rather than a list that moved. It is the
 * framework's own idiom (`@kolu/surface`'s fleet-top example does exactly this
 * with pids).
 *
 * Handing `<For>` the entry OBJECTS happens to survive today — the collection
 * is served with batched `deltas`, which the client folds into a
 * reconcile-backed store, and reconcile mutates each key's object in place, so
 * the identities never move. That is a property of one delivery path rather
 * than of this panel: the per-key path yields a fresh object per frame, and a
 * collection switched onto it would start rebuilding every row several times a
 * second with nothing here changed. Keys do not have that in them to go wrong,
 * and `features/the_agent.feature` asserts the property directly — the same
 * DOM element, before and after an update.
 *
 * This module is also the ONE place in the client where an Effect is run
 * ({@link ./run.ts} is the edge itself). A procedure returns an `Effect`, a
 * click is a DOM event, and the boundary between them belongs somewhere named.
 */

import {
  type AskAnswer,
  type Attached,
  CHAT_OFF,
  type ChatEntry,
  type ChatState,
  type OpFailure,
  type SessionInfo,
  UsageFailure,
} from "@olai/surface"
import { type Accessor, createEffect, createMemo, createSignal, on } from "solid-js"

import { olai } from "../wire.ts"
import { type Call, run } from "../run.ts"
import { attaching } from "./attach.ts"
import { createRows } from "./order.ts"
import { grownText, TRANSCRIPT_TAIL } from "./saying.ts"
import { forget, remember } from "./previews.ts"

/**
 * What asking for the stored conversations answered.
 *
 * TWO ARMS, because there are two answers and they were one: a refused list —
 * an agent that is not running, one that keeps no conversations, a verb that
 * never reached it — resolved to `[]`, which the picker drew as "no stored
 * conversations". That is a sentence about the agent's disk, and it was being
 * used to report that we never got to look at it.
 *
 * The reason travels WITH the refusal rather than being left on the panel's
 * `refused` signal: the click that asked was on the picker, so the picker is
 * where the answer belongs, and one refusal drawn in two places is one a
 * reader learns to skip in both.
 */
export type Sessions =
  | {
    readonly _tag: "listed"
    readonly sessions: ReadonlyArray<SessionInfo>
  }
  | {
    readonly _tag: "refused"
    readonly failure: OpFailure
  }

/**
 * What became of one upload — THREE arms, because there are three answers and
 * two of them used to be `null`.
 *
 * `gone` is not a refusal: the conversation this file was being attached to
 * was left while it uploaded, and the server has already thrown the directory
 * it landed in away. Nothing was refused and nobody needs telling; there is
 * simply no chip to draw. A refusal, on the other hand, is something a person
 * has to be able to read, and it travels back WITH the answer so that the
 * caller can say it beside the rest of the gesture's.
 */
export type Uploaded =
  | { readonly _tag: "stored"; readonly stored: Attached }
  | { readonly _tag: "refused"; readonly failure: OpFailure }
  | { readonly _tag: "gone" }

export interface Chat {
  /** Where the conversation stands: session, model, commands, whether a turn
   *  is running. */
  readonly state: Accessor<ChatState>
  /** The row KEYS, in conversation order. Keys rather than values so a
   *  `<For>` over them diffs stable strings — see the header. */
  readonly rows: Accessor<ReadonlyArray<string>>
  /** One row's current value, read lazily inside that row. `undefined` while a
   *  key is in the list and its value has not arrived (or has just left). */
  readonly entry: (key: string) => Accessor<ChatEntry | undefined>
  /** The last thing a VERB refused — an empty message, a turn already running.
   *  Separate from `state().trouble`, which is what went wrong where nobody was
   *  waiting: this one belongs to the click that caused it. */
  readonly refused: Accessor<OpFailure | null>
  /** Say what a whole GESTURE refused, on the same line every other refusal is
   *  said on — or clear that line, when it refused nothing.
   *
   *  One drop is one answer. Attaching is the only verb a person can aim at
   *  several things at once, and the reasons come from two places: files the
   *  shared gate turns down before there is a call to make ({@link
   *  ./holding.ts}), and uploads the server refuses. Said one at a time, each
   *  is wiped by the next file's answer — which is a file dropped into the
   *  panel disappearing with nothing about it on screen. So the caller
   *  collects them and says them together, here, rather than into a second
   *  signal of its own: a refusal drawn in two places is one a reader learns
   *  to skip in both. */
  readonly refuse: (reasons: ReadonlyArray<string>) => void
  /** What was typed, the files already attached to it — by the paths
   *  {@link Chat.attach} answered with — and the nodes it is ABOUT, by id.
   *
   *  Answers whether the server TOOK it. A composer clears the box the moment
   *  it sends, which is right — but a send that was refused has to be able to
   *  put back what it threw away, and the refusal alone does not say what the
   *  message was.
   *
   *  IDS for the context and not the nodes themselves: what this tab drew is a
   *  frame old, and the set is the server's to read (`server/src/context.ts`).
   *  A refusal here is usually exactly that — an armed node the set no longer
   *  declares — and it says so in the ops layer's own words. */
  readonly send: (
    text: string,
    attachments: ReadonlyArray<string>,
    context: ReadonlyArray<string>,
  ) => Promise<boolean>
  /** Send a file to the conversation's tmp directory, chunk by chunk, and
   *  answer with what became of it.
   *
   *  It ANSWERS the refusal rather than drawing it, which is the difference
   *  between one file and a gesture: several files dropped together are
   *  several of these calls, and a verb that drew each answer as it came would
   *  rub out the last one's. The caller collects them and says them once
   *  ({@link Chat.refuse}). */
  readonly attach: (file: File) => Promise<Uploaded>
  /** Try a message the agent would not take again — `id` is the row's own key,
   *  and the SERVER still holds the prompt behind it. Nothing is rebuilt here:
   *  the row carries its pictures by name, and a retry assembled from what is
   *  on screen would be a different message. */
  readonly resend: (id: string) => void
  readonly cancel: () => void
  /** Start a fresh conversation with one of {@link ChatState.roster}'s agents.
   *  The id is REQUIRED because every new chat asks which one — see the
   *  surface's declaration, and `./Choose.tsx`, which is what asks. */
  readonly newSession: (agent: string) => void
  /** Answer the panel's own question ({@link ChatState.talking}'s `asking`
   *  arm): this agent,
   *  now open the conversation you would have opened. Not the same verb as
   *  {@link Chat.newSession} — a boot that stopped to ask has not asked for a
   *  new conversation. */
  readonly chooseAgent: (agent: string) => void
  readonly loadSession: (id: string) => void
  /** Try the OPEN the agent refused again. It takes no argument, and that is
   *  the same rule { Chat.resend} follows: the SERVER holds which one was
   *  asked for, because a boot picks its own conversation and a browser naming
   *  one would be asking for something nobody asked for. */
  readonly reopen: () => void
  /** Asked of the server every time the picker opens: the agent's list is the
   *  only one that is right. Answers {@link Sessions} — the list, or WHY there
   *  is none — because the two are different answers and used to be the same
   *  one. */
  readonly sessions: () => Promise<Sessions>
  /**
   * Answer a question the agent asked — `id` is the ask row's own id.
   *
   * `done` is called when the verb came BACK, whichever way it went: the server
   * took the answer, or refused it. It is not "it worked" — what worked shows
   * up as the row settling, like every other consequence in this panel — it is
   * only "the call is no longer in flight", which is what a form needs to know
   * to stop being pressable twice.
   */
  readonly answer: (
    id: string,
    answers: ReadonlyArray<AskAnswer>,
    done?: () => void,
  ) => void
  /** ... or decline it, which the agent is told about as such. */
  readonly decline: (id: string, done?: () => void) => void
}

/**
 * Where the conversation stands, and NOTHING else.
 *
 * For a reader that has to know whether a turn is running without drawing the
 * conversation — the header toggle and the minimized pill. It subscribes the
 * cell (small) and deliberately not the transcript. The minimized face's last
 * message is a module snapshot in `last.ts`, written only while the open panel
 * is mounted — never a second transcript subscription.
 */
export const createChatState = (): Accessor<ChatState> => {
  const cell = olai.cells.chat.use()
  // The cell always has a value: the spec declares a default, and the framework
  // seeds the subscription with it — so `off` is what a page reads before the
  // first frame, which is exactly what it should read.
  return () => cell.value() ?? CHAT_OFF
}

export const createChat = (): Chat => {
  const state = createChatState()
  const transcript = olai.collections.transcript.use()
  // THE ROW STILL BEING SAID, in pieces. A second subscription rather than a
  // second delivery of the first, and the reason a streaming answer costs the
  // socket the answer rather than three hundred copies of its prefixes
  // ({@link ./saying.ts}).
  const tail = olai.collections.saying.use().fold(TRANSCRIPT_TAIL)
  const [refused, setRefused] = createSignal<OpFailure | null>(null)

  /** The pieces, joined — a fresh value on every frame a growing row sends. */
  const said = createMemo(() => tail()?.tail ?? null)
  /** WHICH row they belong to, which is what nearly every reader needs: it
   *  moves once a paragraph, so a row asking whether it is the growing one is
   *  woken when a paragraph opens and not once per frame of one. Reading
   *  {@link said} instead would put every row on screen on the tail's own
   *  clock, which is the walk-per-token this panel's fold already retired
   *  ({@link ./order.ts}). */
  const saying = createMemo(() => said()?.of ?? null)

  /**
   * One row's value, with whatever is still being said laid onto it.
   *
   * HERE rather than in the component that draws the text, so that everything
   * downstream — the row, the lane above it, the minimized pill's last message
   * — reads one complete row and no consumer has to know the wire delivers a
   * growing one in two halves. The join is total and idempotent, so this is
   * the whole of the knowledge ({@link ./saying.ts}).
   *
   * The row itself is handed back UNCHANGED whenever nothing is added to it,
   * which is every row but one and every frame after a paragraph ends: the
   * collection reconciles its values in place, so an identity that survives a
   * frame is what keeps a memo over a row from re-running on somebody else's
   * token.
   */
  const entry = (key: string): Accessor<ChatEntry | undefined> => () => {
    const row = transcript.byKey(key)?.()
    if (row === undefined || saying() !== key) return row
    const held = said()
    if (held === null) return row
    const text = grownText(row, held)
    return text === row.text ? row : { ...row, text }
  }

  // THE ORDER, FOLDED — the wire's own frames accumulated into a key list
  // instead of the whole transcript being re-read and re-sorted per frame.
  // {@link ./order.ts} is where that shape is argued and where the reader's
  // half of it lives with it.
  const rows = createRows(transcript.fold)

  /** Every verb the same way: clear the last refusal, run, and keep whatever
   *  this one refuses with. A verb that SUCCEEDS says nothing — the transcript
   *  is where its consequences show up.
   *
   *  `done` is told the call came back, either way. Only a caller that has to
   *  stop being clickable while it waits passes one; the rest fire and forget,
   *  which is what "the consequences arrive on the transcript" means. */
  const verb = (effect: Call<unknown>, done?: () => void) => {
    setRefused(null)
    run(
      effect,
      (failure) => {
        setRefused(failure)
        done?.()
      },
      () => done?.(),
    )
  }

  // A conversation ended, so what belonged to it did too: the server threw its
  // tmp directory away, and the thumbnails this tab was keeping are of files
  // that no longer exist under names the next conversation will mint again.
  // Here rather than in a component because this is where the session is
  // known — the cell is the only thing that says a conversation changed.
  createEffect(
    on(() => state().session?.id, () => forget(), { defer: true }),
  )

  return {
    state,
    rows,
    entry,
    refused,
    refuse: (reasons) =>
      setRefused(
        reasons.length === 0
          ? null
          : new UsageFailure({ reason: reasons.join("\n") }),
      ),
    send: (text, attachments, context) =>
      new Promise((resolve) => {
        setRefused(null)
        run(
          olai.procedures.chat.send({ text, attachments, context }),
          (failure) => {
            setRefused(failure)
            resolve(false)
          },
          () => resolve(true),
        )
      }),
    // The chunk loop is a composed effect ({@link ./attach.ts}) rather than a
    // verb of its own: what a caller waits for is the path, because it is what
    // the next `send` carries.
    attach: (file) =>
      new Promise<Uploaded>((resolve) => {
        // WHICH conversation this is being attached to, read before the first
        // chunk goes out. An upload takes as many round trips as the file
        // has chunks, and leaving a conversation is allowed throughout — only
        // a running TURN blocks that. So the answer can arrive after the
        // server has thrown the directory it names away, and after the effect
        // below has cleared what belonged to it. Answering `gone` then is the
        // honest thing: the file is gone, and a chip for it would offer a send
        // the server would refuse.
        const asked = state().session?.id
        run(
          attaching(file, (chunk) => olai.procedures.chat.attach(chunk)),
          (failure) => resolve({ _tag: "refused", failure }),
          (stored) => {
            if (state().session?.id !== asked) return resolve({ _tag: "gone" })
            // The Blob is the one already in hand — this tab is the only
            // reader that will ever have it, and the name it is filed under is
            // the SERVER's, which is what the transcript row will carry.
            remember(stored.name, file)
            resolve({ _tag: "stored", stored })
          },
        )
      }),
    resend: (id) => verb(olai.procedures.chat.resend({ id })),
    cancel: () => verb(olai.procedures.chat.cancel()),
    newSession: (agent) => verb(olai.procedures.chat.newSession({ agent })),
    chooseAgent: (agent) => verb(olai.procedures.chat.chooseAgent({ agent })),
    loadSession: (id) => verb(olai.procedures.chat.loadSession({ id })),
    reopen: () => verb(olai.procedures.chat.reopen()),
    answer: (id, answers, done) =>
      verb(olai.procedures.chat.answer({ id, answers }), done),
    decline: (id, done) => verb(olai.procedures.chat.decline({ id }), done),
    sessions: () =>
      new Promise((resolve) => {
        run(
          olai.procedures.chat.sessions(),
          (failure) => resolve({ _tag: "refused", failure }),
          (sessions) => resolve({ _tag: "listed", sessions }),
        )
      }),
  }
}
