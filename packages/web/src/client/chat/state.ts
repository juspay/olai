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
  type Listed,
  UsageFailure,
} from "@olai/surface"
import { type Accessor, createEffect, createMemo, createSignal, on } from "solid-js"

import { olai } from "../wire.ts"
import { type Call, run } from "../run.ts"
import { attaching } from "./attach.ts"
import { createRows } from "./order.ts"
import { createTail, grownText } from "./growing.ts"
import { forget, remember } from "./previews.ts"
import { closePreview } from "./previewing.ts"

/**
 * What asking for the stored conversations answered.
 *
 * TWO ARMS, because there are two answers and they were one: a refused list —
 * chat switched off, a call that never reached the server — resolved to `[]`,
 * which the picker drew as "no stored conversations". That is a sentence about
 * somebody's disk, and it was being used to report that we never got to look at
 * it.
 *
 * The reason travels WITH the refusal rather than being left on the panel's
 * `refused` signal: the click that asked was on the picker, so the picker is
 * where the answer belongs, and one refusal drawn in two places is one a
 * reader learns to skip in both.
 *
 * THE SAME DISTINCTION ONE LAYER IN. The list spans every installed agent now,
 * so "could not ask" is usually a fact about ONE OF THEM rather than about the
 * call — and it travels inside the listed answer ({@link Listed}'s
 * `unreachable`), for the same reason and with the same consequence: an agent
 * that is broken is named, and the other's conversations are still on the
 * screen. This arm is what is left, which is the whole call failing.
 */
export type Sessions =
  | ({ readonly _tag: "listed" } & Listed)
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
  /** The row KEYS OF THE CONVERSATION'S OWN COLUMN, in order. Keys rather than
   *  values so a `<For>` over them diffs stable strings — see the header.
   *
   *  NOT every row: a subagent's tool calls are filed under the agent that
   *  made them and are drawn where that agent is drawn ({@link lanes}), so this
   *  is the main agent's work and the reader's, plus every question whoever
   *  asked it. */
  readonly rows: Accessor<ReadonlyArray<string>>
  /** ... and each spawned agent's own calls, by the transcript key of the
   *  `Agent` frame that sent it out — what a preview of that agent draws, in
   *  the same order the conversation put them in. Empty for every conversation
   *  that spawned nobody. */
  readonly lanes: Accessor<ReadonlyMap<string, ReadonlyArray<string>>>
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
    /** INTERRUPT the turn the agent is running with this, rather than take a
     *  place behind it. The deliberate gesture and nothing else: absent, this
     *  message waits its turn at the agent, which is what pressing enter
     *  means. Only offered where the agent said it takes one
     *  (`@olai/surface`'s `Talking.steers`). */
    steer?: boolean,
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
  /** Move to a stored conversation — WITH the agent whose it is, which the
   *  row carries. The list spans every installed agent, so this is a change of
   *  agent as often as it is a change of conversation. */
  readonly loadSession: (agent: string, id: string) => void
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
  /**
   * POINT ONE PLUGIN'S DOORBELL AT ONE FILE, for this conversation — or, with
   * `file: null`, at nothing, which is how one is turned off.
   *
   * WITH THE PAIR, the way {@link Chat.loadSession} takes one: a session id
   * means nothing to the wrong agent, and the panel's own conversation can move
   * under a picker somebody left open — a boot opens one with nothing called at
   * all — so a pick that meant "whichever conversation is in front of me" would
   * sometimes be attached to one a person was not looking at. What is read for
   * that pair is read at the CLICK ({@link ./Wake.tsx}), which is the moment the
   * person meant.
   *
   * THE ORDER IS THE WIRE'S — `agent`, `session`, `plugin`, `file`, exactly the
   * member's own field order one hop down and the order `@olai/chat`'s own
   * `scope` takes them in (the pair, then the plugin, then the file). Three
   * adjacent strings is a signature where the compiler cannot help: any
   * permutation type-checks, and a caller that swapped two would store a pick
   * under a plugin name nothing rings and a conversation nobody has. IT USED TO
   * lead with the plugin, on the argument that the subject belongs first — a
   * good sentence and a second order for one tuple, which is the whole of what
   * makes such a swap silent.
   *
   * One verb and not a `clear` beside a `set`: there is one fact here and it
   * has an empty value.
   */
  readonly scope: (
    agent: string,
    session: string,
    plugin: string,
    file: string | null,
  ) => void
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
  const served = createChatState()
  const transcript = olai.collections.transcript.use()
  // THE ROW STILL BEING SAID, in pieces. A second subscription rather than a
  // second delivery of the first, and the reason a streaming answer costs the
  // socket the answer rather than three hundred copies of its prefixes
  // ({@link ./growing.ts}).
  const said = createTail(olai.collections.saying.use().fold)
  const [refused, setRefused] = createSignal<OpFailure | null>(null)

  /**
   * THE ROW STILL BEING SAID, joined — computed ONCE per frame however many
   * readers ask for it.
   *
   * A memo rather than the join written into {@link entry} below, and the
   * reason is identity rather than arithmetic: three tracked scopes read the
   * growing row in one frame (the row itself, the lane over it, the lane of
   * the row under it), and a join done per call hands each of them a
   * different object for the same row. `./Transcript.tsx` says in place why
   * that matters — an entry's identity surviving a frame is what stops one
   * row's token re-running the attribute effects of every row on screen — and
   * a per-call join would have quietly made that untrue for the one row it is
   * about.
   *
   * The row is handed back UNCHANGED whenever nothing is added to it, which is
   * every frame after a paragraph ends: the pieces are still on the wire until
   * the row that supersedes them is, and the join answers with the row itself
   * for every one of them.
   */
  const grown = createMemo((): ChatEntry | undefined => {
    const key = said.of()
    const held = said.tail()
    const row = key === null ? undefined : transcript.byKey(key)?.()
    if (row === undefined || held === null) return row
    const text = grownText(row, held)
    return text === row.text ? row : { ...row, text }
  })

  /**
   * One row's value — with whatever is still being said laid onto it, when it
   * is the row being said into.
   *
   * THE JOIN IS HERE rather than in the component that draws the text, so that
   * everything downstream — the row, the lane above it, the minimized pill's
   * last message — reads one complete row and no consumer has to know the wire
   * delivers a growing one in two halves ({@link ./growing.ts}).
   *
   * WHICH row is growing is asked of a memo that moves once a paragraph, so
   * every other row on screen is woken when a paragraph opens rather than on
   * every frame of one.
   */
  const entry = (key: string): Accessor<ChatEntry | undefined> => () =>
    said.of() === key ? grown() : transcript.byKey(key)?.()

  // THE ORDER, FOLDED — the wire's own frames accumulated into a key list
  // instead of the whole transcript being re-read and re-sorted per frame.
  // {@link ./order.ts} is where that shape is argued and where the reader's
  // half of it lives with it.
  const rows = createRows(transcript.fold)

  /**
   * A VERB THAT OPENS A CONVERSATION IS IN FLIGHT — this tab's own reading,
   * true from the click rather than from the server's first frame.
   *
   * The three doors that open one (`+ new`, the picker's answer, a stored
   * conversation) each start a subprocess or a replay, and none of them is
   * instant. The server says `booting` the moment it begins, but that word has
   * to travel: between the click and the frame carrying it, the cell still
   * reads `idle` — so the panel looked FINISHED for the first frames of the
   * longest wait it has, which is exactly when somebody presses the thing
   * again.
   *
   * THIS TAB'S, deliberately, like the picker's own question one level up
   * (`./Panel.tsx`): it is a person part-way through a gesture. A second tab
   * has no business being told this one clicked something, and the moment the
   * server has an opinion the server's is what everyone sees.
   *
   * It is a COUNT rather than a flag because the doors can be pressed in
   * sequence, and a second answer coming back must not clear a first that is
   * still in flight.
   */
  const [starting, setStarting] = createSignal(0)

  /**
   * Where the conversation stands, with this tab's own press folded in.
   *
   * The override is ONE-WAY and it is the narrow one: a panel the server calls
   * `idle` while a press of ours is in flight is a panel that is starting.
   * Every other state is the server's and passes straight through — `thinking`
   * is a turn we would be lying about, `gone` is a process this tab cannot see,
   * and `off` is a machine with no agent at all.
   */
  const state: Accessor<ChatState> = createMemo((): ChatState => {
    const now = served()
    return starting() > 0 && now.status === "idle" ? { ...now, status: "booting" } : now
  })

  // ... and this tab's guess lives only until the SERVER has one. The moment
  // the served status is anything but `idle`, the server has taken the story
  // over — it says `booting` itself, or the open finished, or the agent went —
  // and a press still counted here would be a fiction outliving its cause. It
  // is also the bound on the one way the count could stick: a call that never
  // settles never runs its `done`.
  createEffect(
    on(() => served().status, (status) => {
      if (status !== "idle") setStarting(0)
    }, { defer: true }),
  )

  /** A verb that opens a conversation: the panel says so from the click, and
   *  stops saying it when the call comes back — however it went. `max(0, …)`
   *  because the effect above can zero the count while a call is still in
   *  flight, and a negative one would report `booting` for every later press
   *  that ended. */
  const opens = (effect: Call<unknown>) => {
    setStarting((held) => held + 1)
    verb(effect, () => setStarting((held) => Math.max(0, held - 1)))
  }

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

  // A conversation ended, so what belonged to it did too, and there are two
  // such things now. The thumbnails this tab was keeping are of files that no
  // longer exist, under names the next conversation will mint again — the
  // server threw its tmp directory away. And an open PREVIEW is addressed by a
  // transcript key ({@link ./previewing.ts}), which is exactly the kind of name
  // the next conversation re-mints: a fresh transcript counts from `tool:1`, so
  // a key left over from the last one does not merely go stale, it can COLLIDE —
  // opening a shelf nobody pressed on somebody else's third tool call, and
  // lighting the pressed state on the wrong door in the strip and in the
  // transcript. The shelf's own guard hides a MISSING row and cannot see that
  // one, which is why the fix is here and not there.
  //
  // Here rather than in a component because this is where the session is known —
  // the cell is the only thing that says a conversation changed — and both are
  // in one effect because they are one event.
  createEffect(
    on(() => state().session?.id, () => {
      forget()
      closePreview()
    }, { defer: true }),
  )

  return {
    state,
    rows: rows.keys,
    lanes: rows.lanes,
    entry,
    refused,
    refuse: (reasons) =>
      setRefused(
        reasons.length === 0
          ? null
          : new UsageFailure({ reason: reasons.join("\n") }),
      ),
    send: (text, attachments, context, steer) =>
      new Promise((resolve) => {
        setRefused(null)
        run(
          // The flag is spelled only when it is TRUE, which is the wire's own
          // shape for it: an ordinary send says nothing about interrupting,
          // the way an ordinary row says nothing about a delivery.
          olai.procedures.chat.send({
            text,
            attachments,
            context,
            ...(steer === true ? { steer: true } : {}),
          }),
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
    // The three doors that OPEN a conversation, and the fourth that reopens
    // a refused one. Each says so from the click ({@link opens}).
    newSession: (agent) => opens(olai.procedures.chat.newSession({ agent })),
    chooseAgent: (agent) => opens(olai.procedures.chat.chooseAgent({ agent })),
    loadSession: (agent, id) => opens(olai.procedures.chat.loadSession({ agent, id })),
    // An ordinary verb, and deliberately not one of the four above: pointing a
    // doorbell at a file opens nothing, so the panel has nothing to say from
    // the click — what it did shows up as the strip's own row changing, which
    // is where somebody who just picked a file is already looking.
    scope: (agent, session, plugin, file) =>
      verb(olai.procedures.chat.scope({ agent, session, plugin, file })),
    reopen: () => opens(olai.procedures.chat.reopen()),
    answer: (id, answers, done) =>
      verb(olai.procedures.chat.answer({ id, answers }), done),
    decline: (id, done) => verb(olai.procedures.chat.decline({ id }), done),
    sessions: () =>
      new Promise((resolve) => {
        run(
          olai.procedures.chat.sessions(),
          (failure) => resolve({ _tag: "refused", failure }),
          (listed) => resolve({ _tag: "listed", ...listed }),
        )
      }),
  }
}
