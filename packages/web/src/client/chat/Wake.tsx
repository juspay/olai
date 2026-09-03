/**
 * WHAT THIS CONVERSATION WAKES ON — the strip under the other two, and the file
 * picker in it.
 *
 * A plugin can ring this conversation's doorbell: when something it watches
 * happens, it puts a whole sentence into the transcript the way a person does
 * (`@olai/plugin-api`'s `Deliveries`, and {@link ./Entry.tsx} for what one looks
 * like when it lands). WHICH conversation it may ring, and about what, is a
 * person's answer and nobody else's — this is where they give it.
 *
 * ## THE RULING THIS DRAWS, and it is a ruling rather than a default
 *
 * Scope is MANUAL and per conversation. There is no serve-level default, no
 * setting, and nothing an agent can call: a fresh conversation, and one somebody
 * cleared, wakes on nothing until a person picks a file. So the row's ordinary
 * state is `off` and it is still DRAWN — a control that appeared only once it
 * had been used would be a control nobody finds. That the verb behind it is the
 * browser's alone is physics rather than a promise: `@olai/server`'s `faces.ts`
 * names `chat.scope` on the browser face and nowhere else, and `faces.test.ts`
 * pins the agent's face as an exact set.
 *
 * ## A FOURTH SIBLING IN `Face`, and not a line on the strip above
 *
 * {@link ./Watching.tsx} is the obvious place and it is the wrong one: it
 * unmounts whenever nothing is running, which is nearly every conversation
 * nearly all of the time, so a control put there would vanish exactly when
 * somebody went looking for it. {@link ./Roster.tsx}'s rule is the one this
 * follows instead — a standing fact about the conversation, above the scroll and
 * never carried away by it, drawn on every conversation and absent only where
 * there is no conversation to have one.
 *
 * ORDER, by the header essay's own argument (`./Panel.tsx`): the servers are
 * what this conversation HAS, what is running is what it is DOING, and this is
 * what it is LISTENING for — the fact with the longest life last, because it is
 * the one that changes least often and a strip that moved under a reader would
 * be the reason the other two are ordered at all.
 *
 * ## CORE DRAWS THE CONTROL AND SPELLS NONE OF THE SENTENCE
 *
 * Every noun in the row is the plugin's, arriving as data on two members and
 * joined over values in {@link ./wake.ts}: what the wake is on, what to call the
 * file, and what a held sentence is in both numbers. What is core's is the
 * arrangement, the punctuation, the numeral, and the picker. That split is why
 * the sentence travels in three pieces — one string with a hole in it would
 * make core the author of everything around the hole — and it is what lets a
 * third plugin grow a doorbell without a line of this file moving.
 *
 * ## AND THE TWO STATES WHERE THE CONTROL SAYS SOMETHING IS WRONG
 *
 * A person picks `lanes.olai`; somebody renames it. Or the file is right there
 * and is not a kind this doorbell can read. Either way it derives nothing —
 * forever — and the conversation goes quiet in a way that reads exactly like a
 * subject with nothing to report. The row draws the fault instead of a live
 * answer ({@link ../../../../surface/src/chat.ts}'s `Wake.fault`), because a
 * picker still naming a file nothing will ever read is the control asserting
 * something untrue, and because after this the panel is the only place the
 * difference between quiet and broken is visible at all.
 *
 * THE WORDS IN THOSE LINES ARE CORE'S, which is the sole exception to the
 * paragraph above and does not weaken it. Core is saying that a file IT STORES
 * is one it cannot find, or one it is holding against a declaration it was
 * handed — facts about core's own record, in core's own vocabulary, with
 * nothing in either about what the plugin watches. The sentence the
 * CONVERSATION got is the plugin's own for that cause, delivered once through
 * the door (`@olai/plugin-api`'s `PluginServerHalf.wake.faults`), and this file
 * does not repeat a word of any of them.
 *
 * AND THE GESTURE STILL WORKS. The picker is drawn, open-able and pressable in
 * that state, because picking another file is the fix — a control that reported
 * itself broken and then refused the one gesture that mends it would be worse
 * than the fault it reported.
 *
 * ## THE PICKER IS THE SESSIONS POPOVER'S MODEL, and now its receptacle
 *
 * A `QUIET_PILL` trigger, a list hung from the strip's own box rather than from
 * the button (a narrow list `right-0` of a small pill runs off the left of a
 * phone sheet), `aria-expanded` — {@link ./NodeSessions.tsx} argues those in place.
 * The state machine underneath is not argued twice: one union signal, the
 * client's one dismissal for a pointer outside and Escape, and the caret back on
 * the pill when a press is what shut it, all of them
 * {@link ../inlinePicker.ts}'s. What this adds is a filter box, because the two
 * lists are not the same size: an agent's stored conversations are tens, and a
 * served directory is thousands.
 *
 * The files come from the directory this serve is already handing every reader
 * (`../served.tsx`), matched by the one matcher the composer's `@` list uses
 * (`../file/matching.ts`) — and NARROWED before either, by {@link ./scopable.ts}.
 *
 * IT USED TO OFFER EVERY SERVED FILE, on the reading that what a wake file
 * MEANS is the plugin's business and a core-side rule about which files may be
 * picked would be core deciding something it cannot know. The first half of
 * that is right and the conclusion did not follow: the human's screenshot,
 * 2026-09-01, has `2026-09-01.md` offered between two outlines, and a document
 * has no NODES — so a conversation scoped to one watches the empty set for
 * ever, hears nothing, and is beaten for by a heartbeat that goes on saying the
 * watcher is alive. Core did not have to LEARN anything to close that: the
 * plugin declares which kinds it can watch (`@olai/surface`'s
 * `BuiltPlugin.wake.kinds`) and core offers no other. What is left for core to
 * rule on is core's own files — the trash, the archives, the `_olai/` mints —
 * and that ruling is argued where it is spent.
 *
 * ## AND THE PAIR IS READ AT THE CLICK
 *
 * A pick is addressed to an agent and a session, never to "the conversation in
 * front of me": the panel's own conversation can move under a list somebody left
 * open — a boot opens one with no verb called at all — and a session id means
 * nothing to the wrong agent. Reading the pair when the press happens is what
 * makes the pick belong to the conversation the person was looking at, and the
 * strip is absent altogether when there is no pair to read.
 */

import { agentIn, NO_ROSTER, type PluginRoster, type WakeFault } from "@olai/surface"
import { createMemo, For, Index, Show } from "solid-js"

import { dirOf, folded, type Folded, matchFiles, nameOf } from "../file/matching.ts"
import { createInlinePicker } from "../inlinePicker.ts"
import { WITHIN } from "../layer.ts"
import { QUIET_PILL } from "../pill.ts"
import { useServed } from "../served.tsx"
import { TESTID } from "../testids.ts"
import { olai } from "../wire.ts"
import { scopable } from "./scopable.ts"
import type { Chat } from "./state.ts"
import { type Ringer, ringersOf } from "./wake.ts"

/** How many files the list offers at once — THE FILE LIST'S OWN BOUND, and
 *  deliberately larger than the composer's. The `@` list caps at eight
 *  (`../search/nodes.ts`'s `LIMIT`), but those eight are a budget SHARED
 *  between node rows and file rows: `./naming.ts` does the arithmetic, and a
 *  file half there is only ever the part of eight the node half left. This
 *  strip offers files and nothing else, so the same underlying reason — a list
 *  longer than a glance is a list nobody reads to the end, and what narrows it
 *  is the box above it — lands on a larger number when the whole glance is one
 *  kind of row.
 *
 *  Not an import of that constant, which would read as tidier and is the wrong
 *  coupling: the eight moves when the composer's SHARING arithmetic wants it
 *  to, and a shortlist with no node half to share with would then be resized
 *  by an argument it is not part of. */
const LIMIT = 12

/**
 * WHAT THE STRIP SAYS ABOUT A DOORBELL THAT IS NOT WATCHING, per cause — core's
 * own words, and the only ones on this strip that are.
 *
 * A `Record` over the union rather than a ternary, for the reason the plugin's
 * own sentences are one too (`@olai/plugin-api`'s `PluginServerHalf.wake.faults`):
 * a third cause goes red here naming the line it owes, where an else-arm would
 * quietly draw `gone` over something that is not gone.
 *
 * NEITHER NAMES A KIND. "not an outline" would need core to decide how to say
 * somebody else's list of kind words as nouns, with articles and in both
 * numbers; what core can say without composing anybody's sentence is that this
 * doorbell cannot watch this file — which is the whole of what it knows and the
 * whole of what has to be done about it.
 */
const SAID: Record<WakeFault, string> = {
  gone: "gone — pick another file",
  unwatchable: "not one this can watch — pick another file",
}

/** No file at all — the one array a shut picker answers with, minted once so a
 *  memo that has nothing to offer hands back the value it handed back last. */
const NONE: ReadonlyArray<Folded> = []

/** WHICH conversation a pick belongs to — the pair the verb takes, or nothing,
 *  which is the whole of why the strip is absent. */
interface Addressed {
  readonly agent: string
  readonly session: string
}

export function Wake(props: { readonly chat: Chat }) {
  /** WHAT THE BUILD OFFERS. A direct `use()` for `../settings/Panel.tsx`'s
   *  reason — one reader, nothing to press, nothing to remember — and the
   *  roster is empty before the first frame (`NO_ROSTER`), so a tab that has
   *  not heard from the server draws no doorbell rather than one it cannot
   *  name. */
  const roster = olai.cells.plugins.use()
  const rows = createMemo((): ReadonlyArray<Ringer> => {
    const built: PluginRoster = roster.value() ?? NO_ROSTER
    return ringersOf(built.built, props.chat.state().wake)
  })
  /** The conversation to address a pick to, when there IS one. Both halves or
   *  neither: a session with no agent behind it is a beat between subprocesses,
   *  and a pick sent then would name a conversation nobody can open. */
  const to = (): Addressed | undefined => {
    const state = props.chat.state()
    const agent = agentIn(state)
    const session = state.session
    return agent === null || session === null
      ? undefined
      : { agent: agent.id, session: session.id }
  }
  /**
   * Point one of them at a file, or at nothing.
   *
   * THE PAIR IS READ HERE, at the press, and deliberately not carried in from
   * the `<Show>` above: a conversation can be replaced without passing through
   * "no conversation" — opening a stored one is exactly that — so a pair
   * captured when the strip appeared would go on addressing a conversation
   * somebody has left, silently, and a list left open across a switch is how
   * that gets pressed. Nothing happens where there is no pair, which is a state
   * this control is not drawn in and a press cannot reach.
   */
  const scope = (plugin: string, file: string | null): void => {
    const at = to()
    if (at === undefined) return
    props.chat.scope(at.agent, at.session, plugin, file)
  }
  return (
    <Show when={rows().length > 0 && to() !== undefined && props.chat.state().bound === null}>
      <section
        // `relative` is the picker's containing block: the list hangs from
        // this strip's box the way the sessions list hangs from the header's.
        class="relative shrink-0 border-b border-rule/70 bg-panel px-3 py-1.5 font-mono text-[0.6875rem] leading-snug"
        data-testid={TESTID.chatWake}
        aria-label="wakes on"
      >
        {/* AN `Index` AND NOT A `For`, which is the difference between a
            picker somebody can use and one that shuts under their cursor. The
            rows are joined out of two cells into fresh objects, and the chat
            cell publishes several times a second through a running turn
            (usage, model, questions) — so `<For>`, which diffs by identity,
            would tear every row down and build it again on each of those
            frames, taking the open list and what was typed into it with them.
            What a row IS here is its position in the registry's own order,
            which moves only when a serve is restarted with different plugins:
            that is exactly what an index keys by, and it hands the value in as
            a signal, so the words still follow the wire. */}
        <Index each={rows()}>
          {(ringer) => (
            <p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Line
                ringer={ringer()}
                onScope={(file) => scope(ringer().name, file)}
              />
            </p>
          )}
        </Index>
      </section>
    </Show>
  )
}

/**
 * ONE PLUGIN'S DOORBELL, as a line: `<subject> · <from> <picker>`, and
 * `<subject> · off` where nothing is picked.
 *
 * The lead-in to the file is drawn only where there IS a file, because it is a
 * preposition and reads as a broken sentence with nothing after it — the trigger
 * carries the whole answer on its own in that state, and the answer is `off`.
 *
 * It takes ONE callback and knows nothing about conversations: which pair a pick
 * is addressed to is decided where the pair is read, one level up.
 */
function Line(props: {
  readonly ringer: Ringer
  readonly onScope: (file: string | null) => void
}) {
  return (
    <>
      <span class="min-w-0 truncate text-muted">{props.ringer.subject}</span>
      <span aria-hidden="true" class="text-muted">·</span>
      <Show when={props.ringer.file !== null}>
        <span class="min-w-0 truncate text-muted">{props.ringer.from}</span>
      </Show>
      <Picker ringer={props.ringer} onPick={(file) => props.onScope(file)} />
      {/* THE FAULT, and it is drawn BESIDE the picker rather than instead of
          it. This doorbell is not watching the file it names — the file went,
          or it is a kind this doorbell cannot read — so nothing will ever ring
          here again, and the silence that follows is indistinguishable from the
          silence of a subject with nothing to report, which is the whole reason
          this line exists. The trigger is still pressable, because the fix is
          picking another file and a control that told somebody it was broken
          and then refused the gesture that mends it would be worse than the
          fault.

          A LINE PER CAUSE, because a person has a different thing to do about
          each: a file that went is one to find or re-pick, and a file that is
          there and cannot be read is one to replace. The words are core's and
          the argument for them is where they are written ({@link SAID}); what
          the CONVERSATION was told is the plugin's own sentence for that cause,
          delivered once (`@olai/plugin-api`'s `PluginServerHalf.wake.faults`),
          and no word of any of them is repeated here. */}
      <Show when={props.ringer.fault} keyed>
        {(fault) => (
          <span
            class="shrink-0 text-alarm"
            data-testid={TESTID.chatWakeFault}
            // WHICH fault and about WHICH path, as DATA — a scenario reads the
            // state rather than the sentence, the way the count beside it does.
            data-fault={fault}
            data-file={props.ringer.file ?? ""}
          >
            {SAID[fault]}
          </span>
        )}
      </Show>
      {/* THE WAY BACK OFF, and only where there is something to turn off. The
          same verb with no file rather than a second one: there is one fact
          here and it has an empty value. */}
      <Show when={props.ringer.file !== null}>
        <button
          type="button"
          class="rounded-sm text-muted underline decoration-dotted hover:text-ink"
          data-testid={TESTID.chatWakeClear}
          onClick={() => props.onScope(null)}
        >
          clear
        </button>
      </Show>
      {/* WHAT IT IS HOLDING, drawn only while it is holding something. A
          doorbell's sentence waits for the turn boundary rather than joining
          the turn — so that it cannot spend an interruption nobody typed — and
          the panel's own rule is that the alternative to holding words out of
          sight is not dropping them, it is showing them. `doing`, because this
          is something in flight rather than something wrong. */}
      <Show when={props.ringer.held} keyed>
        {(said) => (
          <span
            class="shrink-0 text-doing"
            data-testid={TESTID.chatWakeWaiting}
            // The NUMERAL as data, because the words around it are the
            // plugin's own and a scenario asserting those would be asserting
            // somebody else's vocabulary.
            data-waiting={props.ringer.waiting}
          >
            {said}
          </span>
        )}
      </Show>
    </>
  )
}

/**
 * THE CONTROL: what is picked, and the list that changes it.
 *
 * The trigger wears the file's own NAME rather than its path, with the whole
 * path on the element as data and as its title — a directory of daily notes is
 * a column of identical prefixes, and a strip is not where a reader should have
 * to follow one to its last segment.
 */
function Picker(props: {
  readonly ringer: Ringer
  /** A FILE, always: turning the doorbell off is the line's own control beside
   *  this one, because a `null` row inside a list of files would be a row that
   *  is not a file, drawn among the files, and the one press somebody makes by
   *  accident when they meant the first path. */
  readonly onPick: (file: string) => void
}) {
  /** Every served file, as the whole app has them (`../served.tsx`) — the chat
   *  panel is drawn inside that provider, so this costs no new plumbing. */
  const files = useServed()
  /** Up over WHAT HAS BEEN TYPED at it, which is this picker's whole payload
   *  ({@link ../inlinePicker.ts}) — and it opens over nothing typed, so a list
   *  reopened is never still narrowed by a search somebody made a conversation
   *  ago. */
  const picker = createInlinePicker<string>({ opening: () => "" })
  const typed = () => picker.showing() ?? ""

  /**
   * WHICH SERVED FILES THIS DOORBELL COULD BE POINTED AT — the whole directory
   * narrowed once, and NOT once per keystroke ({@link ./scopable.ts}).
   *
   * A memo of its own, above the matcher, because the two move on different
   * clocks: what is OFFERABLE changes when the directory does (or when a serve
   * with different plugins is started), and what MATCHES changes on every
   * character typed at it. Folded into the matching pass it was a vault-sized
   * predicate walk and a vault-sized array per keystroke — the exact shape
   * `../file/matching.ts` keeps its fold in a `WeakMap` to avoid — and it also
   * cost {@link matchFiles} its early exit, which stops the moment the best
   * bucket can fill the list.
   *
   * IT READS `open()` TOO, so the pass still happens only while the list is up:
   * a strip is drawn on every conversation and nearly none of them ever opens
   * this. That makes it once per opening rather than once per version of the
   * directory, which is the cheaper of the two errors — a memo that narrowed
   * eagerly would walk the vault for a control nobody pressed.
   *
   * Over the FOLDED entries rather than the paths, so the fold itself is still
   * taken once per version of the directory and shared with the `@` list.
   */
  const offerable = createMemo((): ReadonlyArray<Folded> => {
    if (!picker.open()) return NONE
    const kinds = props.ringer.kinds
    return folded(files()).filter((file) => scopable(kinds, file.path))
  })

  /** ... and those of them the query means, best first. Nothing but the typing
   *  moves this now. */
  const offered = createMemo((): ReadonlyArray<string> =>
    matchFiles(offerable(), typed(), LIMIT).map((file) => file.path)
  )

  /** Whether this doorbell is not watching what it names — either cause, since
   *  the trigger draws the same way for both and the LINE beside it is where
   *  they differ ({@link Line}). */
  const broken = (): boolean => props.ringer.fault !== null

  /** What the trigger says: the picked file's own name, or that there is none.
   *  `off` is the whole answer in that state and reads as one — the lead-in
   *  before it is drawn only when there is a file for it to lead to. */
  const said = (): string => {
    const file = props.ringer.file
    return file === null ? "off" : nameOf(file)
  }

  return (
    <>
      <button
        ref={picker.setTrigger}
        type="button"
        // THE TRIGGER STOPS LOOKING LIKE A LIVE ANSWER when the file it names
        // is not being watched. It goes on wearing the path — that is what
        // somebody has to recognise to know which file it is about — but it stops
        // reading as the quiet statement of fact the other states are. Still
        // pressable, because picking another file is the fix.
        class={`${QUIET_PILL} max-w-[16rem] truncate${broken() ? " text-alarm" : ""}`}
        data-testid={TESTID.chatWakePicker}
        // WHOSE doorbell and WHAT it is pointed at, as data: the words in this
        // line are the plugin's sentence, and the state a scenario asserts must
        // not be read out of somebody else's vocabulary.
        data-plugin={props.ringer.name}
        data-file={props.ringer.file ?? "off"}
        title={props.ringer.file ?? undefined}
        aria-expanded={picker.open()}
        onClick={picker.toggle}
      >
        {said()}
      </button>

      <Show when={picker.open()}>
        <div
          ref={picker.setList}
          // Hung from the STRIP (`relative` on the section above), not from
          // this button: a narrow list `right-0` of a small pill runs off the
          // left of a phone sheet. `inset-x-3 top-full` is the strip's own box,
          // so the list is as wide as the conversation.
          class={`absolute inset-x-3 top-full ${WITHIN.pop} mt-1 max-h-80 overflow-x-hidden overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg`}
          data-testid={TESTID.chatWakeList}
        >
          <input
            ref={(element) => queueMicrotask(() => element.focus())}
            type="text"
            class="w-full rounded bg-transparent px-2 py-1 text-xs text-ink outline-none placeholder:text-muted"
            data-testid={TESTID.chatWakeQuery}
            placeholder="file"
            value={typed()}
            onInput={(event) => picker.show(event.currentTarget.value)}
          />
          <ul class="list-none">
            <Show
              when={offered().length > 0}
              fallback={<li class="px-2 py-1 text-xs text-muted">no such file here</li>}
            >
              <For each={offered()}>
                {(path) => (
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-xs hover:bg-rule"
                      data-testid={TESTID.chatWakeFile}
                      data-file={path}
                      onClick={() => {
                        picker.shut()
                        props.onPick(path)
                      }}
                    >
                      <span class="min-w-0 flex-1 truncate text-ink">{nameOf(path)}</span>
                      {/* WHERE it sits, so two files with one name are told
                          apart without reading a wrapped path. */}
                      <Show when={dirOf(path) !== ""}>
                        <span class="shrink-0 font-mono text-[0.625rem] text-muted">
                          {dirOf(path)}
                        </span>
                      </Show>
                    </button>
                  </li>
                )}
              </For>
            </Show>
          </ul>
        </div>
      </Show>
    </>
  )
}
