/**
 * WHICH CONVERSATIONS A PERSON POINTED A DOORBELL AT, and at which file —
 * remembered across a restart.
 *
 * The `wake` section of chat's one machine-local document, beside the section
 * that remembers which conversation the panel was in ({@link ./memory.ts}). It holds
 * a row per (conversation, plugin) somebody picked a file for, and it is the
 * whole of what turns a doorbell on: there is no serve-level default, nothing
 * an agent can call, and no row a fresh conversation starts with. A doorbell is
 * off until a person picks, and this is where the pick lands.
 *
 * ## The picks, and never the messages
 *
 * A held body does not come through here and never will
 * ({@link ./deliveries.ts} says the same thing from the other side). A pick is
 * a decision somebody made that nothing else can reconstruct; a held body is a
 * derivation of state that is still true, and whatever derived it rings again
 * on its next tick. So a restart comes back knowing which doorbells are on and
 * holding nothing, which is exactly the human's third ruling read from the
 * disk: saved events survive a conversation's SESSION GAPS, and a restart is
 * not a session gap.
 *
 * ## ...and ONE derived fact, which is here because "once" needs a memory
 *
 * {@link Scoped.fault} is the exception to the paragraph above and proves its
 * rule. It is not a pick and not a held body: it records that a conversation
 * HAS ALREADY BEEN TOLD its doorbell is watching nothing, and which of the two
 * ways that was true when it was told. Whether it is still true is re-derived
 * from every published revision and never read off this record
 * ({@link Scopes.faults}); what is written down is the SAYING, because "exactly
 * once, and not again after a restart" is a fact about messages sent and
 * nothing can reconstruct it. A serve that forgot it would say the same thing
 * on every boot for as long as the file stayed renamed.
 *
 * ## The key is the TRIPLE, and the conversation half of it is the pair
 *
 * A conversation is `(agent, session)`, because a session id means nothing to
 * the wrong agent — core's own identity for the thing, already spelled at
 * {@link ./memory.ts} and in `@olai/surface`'s `SessionInfo`, rather than a
 * second one minted here. The third column is the PLUGIN, and it is what makes
 * `Deliveries.scopes()` answerable per plugin: an unkeyed table would hand one
 * plugin the conversations a person scoped to another.
 *
 * `plugin` is an OPAQUE STRING to this file, exactly as `dial` is a key core
 * does not interpret. This package learns no appliance word from it.
 *
 * ## Behind ONE permit, and that is not tidiness
 *
 * `set` IS A READ-MODIFY-WRITE OVER THE MIRROR, and that is what the permit is
 * for. It reads `rows` as `before`, filters the replaced row out as `without`,
 * builds `next` from it, and assigns `next` back — four steps over one variable
 * this module is the only holder of. Two of them interleaved lose a pick and
 * nothing on disk can help: A and B each read the same `before`, each builds a
 * `next` carrying its own row and not the other's, and whichever assigns last
 * is the table — so a person who turned two doorbells on in one gesture apiece
 * finds one of them off, and the answer `set` hands back names rows that left a
 * table that no longer exists. The permit makes the four steps one step, which
 * is the only thing that makes the mirror and the file one fact.
 *
 * Chat's document adapter has a second permit around cross-section writes. This
 * permit remains this state machine's own: it makes two simultaneous picks one
 * ordered mutation before either snapshot is handed to the adapter.
 *
 * ## Capped by COUNT, and never pruned against what an agent lists
 *
 * Thirty-two rows, least-recently-touched evicted. The obvious alternative —
 * drop rows whose session no longer appears in an agent's `session/list` — is
 * refused: that call is PAGED ({@link ./agent.ts}), so membership is not proof
 * of absence, and a wrong prune silently deletes a live scope somebody set. A
 * count cap costs no probe and cannot be wrong about a conversation it has
 * never asked about.
 *
 * A conversation can still become unreachable — `adopt` demotes a remembered
 * one an agent stops listing, and the strip only draws the OPEN conversation's
 * row — so a stranded scope is possible and the cap is what eventually clears
 * it. That is stated rather than hidden.
 *
 * ## What it does with a failure
 *
 * A missing or malformed section is an empty mirror. Filesystem failures are
 * logged by core's LocalState implementation; this parser owns no file IO.
 *
 * ## Two things this deliberately is not
 *
 * **Not a sidecar managed by this writer.** It is a section carried beside
 * `memory` and `heard` by {@link ./local.ts}, the one owner of the whole snapshot.
 *
 * **Not a second failure vocabulary.** {@link ./memory.ts}'s `MemoryFailure` is
 * this package's word for "a kept record would not read or write", and this is
 * a second kept record rather than a second kind of problem.
 */

import { Effect, Semaphore } from "effect"

import type { ChatLocalState } from "./local.ts"
import { MemoryFailure, word } from "./memory.ts"

/** The `kind` these files live under in the state home — the second
 *  subdirectory, beside `chat`'s. */
const WAKE = "wake"

/**
 * How many picks are kept, across every conversation this directory has.
 *
 * See the header for why this is a count rather than a liveness question.
 * Thirty-two is far past a single-user panel's working set — the picks that
 * matter are for conversations somebody still opens — and it is the number
 * {@link ./deliveries.ts} bounds its own two axes by, so there is one number to
 * argue about rather than three.
 */
export const ROWS = 32

/**
 * ONE PICK: whose doorbell, in which conversation, on which file.
 *
 * ## THE ARRAY IS THE ORDER, and there is no second copy of it
 *
 * The rows are held touched-oldest-first, and that is a fact the writers keep
 * rather than one a field records. `set` is the only writer: it filters the
 * touched row out and re-APPENDS it at the end, so a fresh pick and a re-pick
 * both land last and a clear only removes. The order the array is in is
 * therefore exactly "least recently touched, first" — which is the one
 * question {@link capped} has to answer — and it survives the round trip
 * because the record is a JSON array and `JSON.parse` hands an array's
 * elements back in the order they were written. {@link picks} walks that array
 * once, `push`ing as it goes, and never sorts.
 *
 * IT USED TO CARRY A STAMP. An `at` field, ISO-8601, written on every `set`
 * and read by nothing but the cap's eviction order — nothing drew it and
 * nothing ever compared it to a clock. The header on it argued that position
 * "would be an ordering nothing guarantees on the way back in", and that is
 * simply not true of a JSON array: order is the one thing an array does
 * guarantee. So the stamp was a second encoding of a fact the positions
 * already carried, kept in sync by hand, and `capped` paid a
 * map/sort/slice/map/Set/filter to recover an ordering it was handed. A row
 * written by an olai that had not stamped one needed a fallback on top of
 * that. The positions are the order now, and there is nothing left to
 * disagree with them.
 */
export interface Scoped {
  readonly agent: string
  readonly session: string
  /** One of the roster's built plugin names, as DATA. This file spells none. */
  readonly plugin: string
  /** Root-relative and `/`-spelled, the one spelling every path on this wire
   *  uses. What it MEANS is the plugin's business; core stores it and hands it
   *  back. */
  readonly file: string
  /**
   * THIS ROW'S DOORBELL IS WATCHING NOTHING, and why — set once, on the
   * transition, and cleared the moment it comes right again
   * ({@link Scopes.faults}).
   *
   * ## Why it is on the ROW and written to the disk
   *
   * Two properties have to hold at once and only a persisted mark has both.
   * ONCE: a conversation is told its doorbell broke exactly one time, not once
   * per revision for as long as it stays broken — so something has to remember
   * it was already said, and the fine→faulted edge is the only place that
   * decision can be made. AND ACROSS A RESTART: a serve that came back would
   * otherwise re-read the picks, find the same fault, and say it again — every
   * boot, forever, about something the person was told about days ago. Written
   * down, the boot reads a row that is already marked and says nothing while
   * the strip goes on drawing it broken.
   *
   * An in-memory set held beside the table gives the first and not the second,
   * which is the arrangement it is worth naming as refused: it is the one that
   * turns a rename into a message per restart.
   *
   * ## THE WORD OR ABSENT, and never a `false`
   *
   * A row that is fine carries no key: a healed scope is written back without
   * one rather than with a `null`, so the record on disk is the same bytes it
   * was before the fault. `undefined` is what every row written by an olai that
   * predates this field reads as, which is exactly right — an unmarked row is
   * one nothing has been said about, and the first revision after the boot
   * decides.
   *
   * WHICH WORD is the CAUSE, because two of them reach a person as two
   * different sentences ({@link Scopes.faults}): the file is not served, or the
   * file is served and is not a kind that doorbell can watch. The mark is one
   * mark either way — a row is told once that it is watching nothing, not once
   * per cause — so a cause that changes under a still-faulted row is written
   * back and nothing is said again. What it is FOR is the strip, which draws
   * the two differently ({@link ../../surface/src/chat.ts}'s `Wake.fault`).
   *
   * WHAT IT IS NOT is a cache of derived truth. It records that a MESSAGE WAS
   * SENT; whether the doorbell can watch is re-derived from the revision every
   * time, by the caller, and this mark is only ever compared against that fresh
   * answer. A mark that were consulted INSTEAD of the revision would be the
   * Monitor's frozen ignore-list reborn.
   */
  readonly fault?: Fault
}

/**
 * WHY A DOORBELL IS NOT WATCHING — the two ways, and the whole of the union.
 *
 * `gone` is the file that is not in the served set at all: renamed, moved or
 * deleted. `unwatchable` is the file that IS served and whose KIND the doorbell
 * cannot derive anything from — a `.md` under a wake that reads nodes, which is
 * the state a picker that offered every served file could leave on the disk.
 *
 * The words are the wire's own (`@olai/surface`'s `WakeFault`), re-declared
 * here rather than imported for this package's standing reason about what it
 * may name: a record on disk is not a wire value, and the two are held equal by
 * the member that copies one into the other ({@link ./chat.ts}'s `wakeOf`)
 * rather than by a shared literal. What the CAUSES MEAN is core's — the served
 * set and the declaration are both core's to compare — while what is SAID about
 * either is the plugin's string, carried whole.
 */
export type Fault = "gone" | "unwatchable"

/**
 * A ROW THAT IS FAULTED, with the cause KNOWN — what {@link Scopes.faults}
 * answers with, and the shape a caller needs to say anything at all.
 *
 * {@link Scoped.fault} is optional because most rows are fine; a row in this
 * answer never is, by construction — it is the fine→faulted edge. Spelling that
 * as a type rather than leaving the caller to assert it is what makes the
 * sentence lookup at the other end TOTAL: the composition root indexes the
 * plugin's declaration by this word (`@olai/plugin-api`'s
 * `PluginServerHalf.wake.faults`), and an optional one would have made that
 * either a non-null assertion or a ternary with an else-arm that answers for
 * causes nobody wrote a sentence for.
 */
export interface Faulted extends Scoped {
  readonly fault: Fault
}

/**
 * The table, and the two things anybody does with it.
 *
 * A MIRROR plus a write, rather than a read per question, and that shape is
 * forced from above: `Deliveries.scopes()` is SYNCHRONOUS — the composition
 * root builds that blob inside a plain `.map`, and the caller is a watcher sink
 * with no Effect around it — so the in-memory copy is the one that answers and
 * the disk copy follows the write rather than leading the read.
 */
export interface Scopes {
  /** Every pick, in the order they are held. */
  readonly rows: () => ReadonlyArray<Scoped>
  /**
   * Set or CLEAR one — `file: null` clears, which is how a doorbell is turned
   * off — and answer with the rows that LEFT the table.
   *
   * Not a second verb beside a `forget`, because there is one fact here and it
   * has an empty value: two doors onto one row would be a question about which
   * of them a fresh pick goes through.
   *
   * THE RECORD IS THE AUTHORITY AND THE MIRROR FOLLOWS IT. The write happens
   * first and the mirror moves only if it landed, so a refusal a caller is
   * handed means nothing stuck anywhere — the plugin reads the mirror, and a
   * mirror that had moved under a refused write would be a doorbell ringing for
   * a pick the person was just told did not take.
   *
   * WHAT COMES BACK is every row this write removed and did not put back: the
   * one it replaced or cleared, plus any the cap evicted. A caller holding
   * anything on those rows' behalf has to hear about it — that is the whole
   * reason this is not `void`, and an eviction is the arm a caller could not
   * work out for itself.
   */
  readonly set: (
    to: { readonly agent: string; readonly session: string },
    plugin: string,
    file: string | null,
  ) => Effect.Effect<ReadonlyArray<Scoped>, MemoryFailure>
  /**
   * WHICH ROWS' DOORBELLS CAN STILL WATCH WHAT THEY NAME — judged against the
   * revision the caller is holding, marked, persisted, and answered with the
   * ones that JUST BROKE ({@link Scoped.fault}).
   *
   * ## A PREDICATE, and never a set of missing paths
   *
   * The question is asked once per published revision, so what it costs is what
   * a revision costs. A caller that had to hand over the paths that went
   * missing would first have to know which files are scoped — a second member
   * on this interface, or a walk of the served directory to diff against — and
   * both of those are per-revision work proportional to the DIRECTORY. The rows
   * are the small side: at most {@link ROWS} of them, and the caller's answer
   * for one path is a binary search over the set it already has in hand
   * (`@olai/format`'s `documentAt`) plus one lookup in a table it built at boot.
   * So the walk is over the picks and the judgement comes in, which is
   * `conventions.ts`' whole argument one package over, spent here for the same
   * reason.
   *
   * ## IT ANSWERS WITH THE CAUSE, and this file decides nothing about it
   *
   * The two causes are the caller's to tell apart, because both halves of each
   * are the caller's: the SERVED SET is its revision, and WHICH KINDS a
   * doorbell can watch is a declaration its plugin handed it. What this file
   * does with the answer is remember it, hand it to the strip and spend one
   * signal on it — see {@link Scoped.fault} for why a cause that changes under
   * an already-faulted row is written back silently.
   *
   * IT IS ASKED OF EVERY ROW, INCLUDING THE MARKED ONES, and that is what makes
   * healing work at all: a row that has been told it is watching nothing must
   * still be judged, because the file coming back — or being replaced by one of
   * a kind the doorbell reads — is the event that clears it.
   *
   * ## What comes back, and what does not
   *
   * ONLY the rows that crossed from fine to gone on this call — the false→true
   * edge, which is the caller's cue to say something once. A row that was
   * already marked and is still missing is not in the answer, so a second
   * revision with the file still absent says nothing more. A row that HEALED is
   * not in the answer either: the scope resumes and nobody is told, because one
   * fault is one signal and "it came back" is a thing the strip shows rather
   * than a thing worth interrupting a conversation for.
   *
   * ## Nothing moved is no write
   *
   * A revision in which every scoped file is where it was — which is every
   * revision anybody ever publishes — touches no disk and returns the empty
   * array. The alternative, writing the table back per revision, would put a
   * filesystem write on the path of every keystroke that lands in an outline.
   *
   * A WRITE THAT FAILS LEAVES THE MIRROR ALONE, exactly as {@link Scopes.set}
   * does and for a sharper reason here: the mirror moving under a failed write
   * would mean the flag is set in memory and not on disk, so the message is
   * said now AND said again after the next restart. Failing whole means the
   * next revision tries the same edge again, which is the arm that can only
   * cost a delay.
   */
  readonly faults: (
    /** What is wrong with one row's file for one row's doorbell, or `null` for
     *  the file this doorbell can watch — which is every row on every ordinary
     *  revision. The plugin is passed because the second cause is a fact about
     *  THAT doorbell's declaration and not about the file alone. */
    judge: (plugin: string, file: string) => Fault | null,
    /** Whether a fault on this plugin's row can be SAID — a plugin this serve did
     *  not compose, or one declaring no words for it, answers `false` and its
     *  rows are left untouched. The mark is the saying; see the walk. */
    sayable: (plugin: string) => boolean,
  ) => Effect.Effect<ReadonlyArray<Faulted>, MemoryFailure>
}

/** What this section looks like written. The rows are read leniently. */
interface Written {
  readonly scopes?: unknown
}

/**
 * What a read makes of the rows.
 *
 * LENIENT PER ROW rather than all-or-nothing: every field of a pick is
 * load-bearing — a row missing any of them names no conversation, no doorbell
 * or no file — so a damaged row is DROPPED and the rest still open their
 * doorbells. Refusing the whole file over one would turn every doorbell in the
 * directory off, which is the louder failure and the wrong one: the picks that
 * are still legible are still what a person asked for.
 *
 * The per-field rule is {@link ./memory.ts}'s `word`, which is the SAME
 * function the other record reads by rather than a copy of it: leniency is one
 * decision this package makes about its own files, and it used to be spelled
 * here a second time, character for character.
 *
 * ORDER IS PRESERVED, and that is load-bearing rather than incidental — see
 * {@link Scoped}. The rows come back in the order they were written, because a
 * JSON array parses back in the order it was written, and that order is
 * "touched oldest first", which is the whole of what {@link capped} needs.
 */
/** The fault mark a written row carries, as the fragment a fresh row spreads —
 *  the two words, the one legacy `gone: true` that meant the first of them, and
 *  nothing at all for anything else ({@link picks} argues both). */
const markOf = (one: Record<string, unknown>): { fault?: Fault } => {
  const written = one["fault"]
  if (written === "gone" || written === "unwatchable") return { fault: written }
  return one["gone"] === true ? { fault: "gone" } : {}
}

const picks = (held: Record<string, unknown>): ReadonlyArray<Scoped> => {
  const written = (held as Written).scopes
  if (!Array.isArray(written)) return []
  const rows: Array<Scoped> = []
  for (const row of written as ReadonlyArray<unknown>) {
    if (typeof row !== "object" || row === null) continue
    const one = row as Record<string, unknown>
    const agent = word(one["agent"])
    const session = word(one["session"])
    const plugin = word(one["plugin"])
    const file = word(one["file"])
    if (agent === null || session === null || plugin === null || file === null) continue
    // THE FAULT IS NOT LOAD-BEARING, so it is read where the four above are
    // REQUIRED: a row whose mark will not parse is a row that names a
    // conversation, a doorbell and a file perfectly well, and dropping it would
    // turn a person's doorbell off over a byte that means "we already said
    // something about this". Anything but one of the two words reads as an
    // unmarked row, which is the state the next revision decides for itself.
    //
    // A ROW FROM THE OLAI BEFORE THIS ONE wrote `gone: true`, when there was
    // one way for a doorbell to be watching nothing and it needed no word. It
    // is read as the word it meant. That is one line for a record a day old and
    // it is worth it for exactly what the mark IS: dropping it re-tells a
    // conversation about a rename it was already told about, on the first
    // revision after an upgrade.
    rows.push({ agent, session, plugin, file, ...markOf(one) })
  }
  return rows
}

/**
 * The CAP applied — the {@link ROWS} most recently touched, which is the
 * {@link ROWS} at the END.
 *
 * A TAIL SLICE AND NOTHING ELSE, because the array is already in the order
 * this question is about ({@link Scoped} argues why it stays that way). The
 * oldest touch is at index zero, so dropping from the front is the eviction,
 * and what is left is still in the order `rows()` hands out — the strip's
 * source of truth does not move for reasons nobody asked about.
 *
 * Why not sort? Because there is nothing to sort BY that the positions do not
 * already say, and a sort would only be as good as whatever second copy of the
 * order it was reading. That is what this used to do, and {@link Scoped}
 * records what the second copy was.
 */
const capped = (rows: ReadonlyArray<Scoped>): ReadonlyArray<Scoped> =>
  rows.length <= ROWS ? rows : rows.slice(rows.length - ROWS)

export const forLocalState = (local: ChatLocalState): Effect.Effect<Scopes> =>
  Effect.gen(function*() {
    const writing = yield* Semaphore.make(1)

    // AN EMPTY MIRROR AND ONE WARNING, never a refusal to serve: nobody is
    // standing at the screen when a boot reads this, and a directory whose
    // doorbells cannot be read is a directory whose doorbells are off until
    // somebody picks again. The write is the opposite case and refuses.
    const read = local.load(WAKE)
    let rows: ReadonlyArray<Scoped> = []
    if (read !== null) rows = picks(read)

    return {
      rows: () => rows,
      set: (to, plugin, file) =>
        writing.withPermit(Effect.gen(function*() {
          // The table as it stands, held so the answer below can be computed
          // against it: `without` has already dropped the row being replaced,
          // so it is not the thing to compare against.
          const before = rows
          const without = before.filter((row) =>
            !(row.agent === to.agent && row.session === to.session && row.plugin === plugin)
          )
          // FILTER OUT, THEN RE-APPEND, and the second half is the touch: a
          // re-pick leaves the front of the array and arrives at the back, so
          // the positions stay in touched-oldest-first order for
          // {@link capped} to read. This is the only writer of the ORDER, so
          // that is the whole of the invariant ({@link Scoped}).
          //
          // The row is built FRESH, which is where a re-pick loses any
          // {@link Scoped.fault} the old one carried — and that is the answer
          // rather than an accident of the literal. A person who has just
          // pointed this doorbell somewhere is owed the next fault on the new
          // file, and carrying the old file's mark across would swallow it.
          const next = file === null
            ? without
            : capped([...without, { agent: to.agent, session: to.session, plugin, file }])
          // THE RECORD FIRST, AND THE MIRROR ONLY IF IT LANDED. The two are one
          // fact in two places and this is the whole of what keeps them one: a
          // write that fails is a pick that did not stick, and a mirror that
          // had already moved would be a doorbell RINGING for a row the person
          // was just told was refused — the plugin reads the mirror, not the
          // disk, so it would start delivering into a conversation whose strip
          // never said it was on.
          //
          // IT USED TO ASSIGN FIRST, on the reading that the permit made the
          // interleaving unobservable. The permit does keep two WRITES apart;
          // what it cannot do is take back a value a failed write left behind,
          // and the caller is told `failed` either way.
          yield* local.save(WAKE, { scopes: next })
          rows = next
          // ... AND WHO LEFT THE TABLE, so the caller can take back what those
          // rows' doorbells were holding. A clear and a re-point are the rows
          // the caller already knows about; an EVICTION is not, and a person
          // who never touched that conversation has no way to learn its
          // doorbell went quiet — which is exactly the case a caller that could
          // only see `file === null` used to miss.
          return before.filter((row) => !next.includes(row))
        })),
      /**
       * THE PICKS, JUDGED AGAINST A REVISION — see {@link Scopes.faults} for
       * what this answers with and why the argument is a predicate.
       *
       * UNDER THE SAME PERMIT as {@link Scopes.set}, and it is the same
       * read-modify-write over the same variable: this reads `rows`, builds a
       * `next` from it and assigns it back, so a pick landing in between would
       * be a pick that vanishes when this assigns — the exact interleaving the
       * permit was written for, arriving now from a second writer.
       *
       * POSITIONS ARE UNTOUCHED. A `map` writes each row where it stood, so a
       * file going missing is not a TOUCH and cannot walk a conversation to the
       * back of the eviction queue. Nobody made a gesture here; the array's
       * order means "least recently touched", and a rename somebody did in
       * another window is not somebody touching their doorbell
       * ({@link Scoped}).
       */
      faults: (judge, sayable) =>
        writing.withPermit(Effect.gen(function*() {
          const before = rows
          /** The fine→faulted edges, and only those — the caller's cue to say
           *  something once. Each carries its cause, because the caller reaches
           *  for a sentence with it ({@link Faulted}). */
          const fell: Array<Faulted> = []
          let moved = false
          const next = before.map((row) => {
            // A ROW NOBODY CAN BE TOLD ABOUT IS LEFT ALONE ENTIRELY, mark and
            // all. A serve running `--plugins` without this row's tenant can
            // still SEE the file went — but nothing would say so, and marking it
            // would spend the one signal on a serve with no doorbell to lose:
            // turn that plugin back on and the row is already marked, so the
            // conversation is never told. The mark and the saying are one act
            // and this is what keeps them one.
            if (!sayable(row.plugin)) return row
            const wrong = judge(row.plugin, row.file)
            const marked = row.fault
            // NOTHING TO SAY AND NOTHING TO WRITE — a fine row that was fine,
            // or a broken one broken the same way it was already told about.
            // The first is every row on every revision anybody ever publishes,
            // and the second is what keeps a standing fault off the disk for as
            // long as it stands.
            if (wrong === (marked ?? null)) return row
            moved = true
            if (wrong === null) {
              // IT CAME RIGHT. Written back without the key rather than with a
              // `null`, so a healed table is the same bytes an untroubled one
              // is ({@link Scoped}) — and nothing is said, because one fault is
              // one signal and the strip is where "it is fine again" shows.
              return { agent: row.agent, session: row.session, plugin: row.plugin, file: row.file }
            }
            const broken: Faulted = { ...row, fault: wrong }
            // ONE SIGNAL PER FAULT AND NOT PER CAUSE. A row already marked is a
            // conversation that has already been told its doorbell is watching
            // nothing; the cause moving under it — a `.md` that was scoped and
            // is now also deleted — changes what the STRIP should say and not
            // whether there is anything to interrupt anybody with. So the new
            // word is written and `fell` is left alone.
            if (marked === undefined) fell.push(broken)
            return broken
          })
          // NOTHING MOVED IS NO WRITE, which is every revision but the two this
          // member exists for. A table written back per revision would put a
          // filesystem write behind every keystroke that lands in an outline.
          if (!moved) return []
          // THE RECORD FIRST AND THE MIRROR ONLY IF IT LANDED, for
          // {@link Scopes.set}'s reason sharpened: a mirror that moved under a
          // failed write would have the fault marked in memory and not on disk,
          // so the sentence would go out now AND again after the next restart.
          // Failing whole leaves the same edge for the next revision to find.
          yield* local.save(WAKE, { scopes: next })
          rows = next
          return fell
        })),
    }
  })
