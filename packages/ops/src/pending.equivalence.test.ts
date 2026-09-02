/**
 * THE COMMITTED SIDE IS REMEMBERED, and answers exactly what re-reading it
 * answered.
 *
 * The claim of `perf-git-per-write` is an equivalence, so the shape of this
 * file is a differential and not a table of expectations: `./committed.testlib.ts`
 * holds the computation as it was — one `git show HEAD:<file>` subprocess and
 * one full parse per dirty outline, per revision, with nothing remembered — and
 * every case here drives TWO `Committing` instances over ONE repository and ONE
 * store, stepping a scripted git session and asserting that what a browser
 * would be handed is IDENTICAL at every step. Both halves of what the chrome
 * draws are compared, because both come out of the one survey: the panel's
 * node-level changes, its other-file rows, its unreadable list, its composed
 * message and its last-commit line (the audit view's inputs), and the header's
 * git indicator (the pill).
 *
 * WHAT THE SCRIPT IS FOR is the seams the roadmap node named, and it is written
 * as one continuous session rather than as independent cases because the bug a
 * cache has is never in the first revision — it is in the revision after
 * something moved:
 *
 *   - a KEYSTROKE, which is the common case and the one that used to pay for
 *     every other dirty file in the directory;
 *   - a file BECOMING dirty, which is the one revision that still owes a read;
 *   - an edit made OUTSIDE olai, which moves the working side under a store
 *     that was not told;
 *   - a COMMIT, which moves HEAD while the working tree stays put;
 *   - a CHECKOUT to another branch and back, which moves HEAD and the working
 *     tree together — the resync path;
 *   - an AMEND and a `reset --soft`, which move HEAD without moving one byte on
 *     disk, and which land the session back on a sha it has already been on;
 *   - the INDEX-ONLY corners — a file restored out of a commit
 *     (`git checkout <rev> -- <file>`), and one staged and then edited again.
 *     They CANNOT split the arms and are here anyway, because "cannot" is a
 *     derivation the next reader should not have to redo: `git show` reads the
 *     OBJECT STORE and neither the index nor the working tree, so neither arm's
 *     answer has an index in it at all — what moves is the dirty list, which is
 *     re-surveyed every revision, and the working side, which is the store's
 *     fresh parse. A step that says so is cheaper than the argument;
 *   - a RENAME, whose committed side is asked for under a name the working tree
 *     does not have any more, and a rename INTO the format, whose committed
 *     side is not an outline at all;
 *   - a file that BREAKS and mends;
 *   - and a repository with NO COMMITS YET, where there is no committed side to
 *     remember.
 *
 * THE SECOND CLAIM is a count, and it is here rather than in a bench because it
 * is the part that must not regress silently: the arms are handed a repository
 * that counts what they spend (`./committed.testlib.ts`'s `counting`), so "a
 * keystroke costs one subprocess whatever is waiting" is an assertion rather
 * than a milliseconds figure somebody has to squint at. The bench
 * (`./pending.bench.ts`) prints what that is worth in time.
 *
 * WHAT IS NOT ASSERTED HERE is anything about what either side SAYS — that is
 * `./pending.test.ts`'s, which pins this layer's promises against fixtures
 * small enough to write down. This file holds two implementations to one answer
 * and has no opinion about what that answer is.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"

import { outline, type Session, withArms } from "./pending.testlib.ts"

const HOUSE = outline(
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
)
const GARDEN = outline(
  `{"id":"garden","ord":"a0","title":"Garden"}`,
  `{"id":"beds","parent":"garden","ord":"a1","title":"build the beds"}`,
)
const SHED = outline(`{"id":"shed","ord":"a0","title":"Shed"}`)

/** One step of the session: what it did, and what it did it with. */
interface Step {
  readonly name: string
  readonly run: () => void
}

/** Where the two arms disagreed. An object rather than a boolean, because a
 *  differential whose failure message is `expected false to be true` is a
 *  differential nobody can act on at four in the morning. */
interface Divergence {
  readonly step: string
  readonly cached: unknown
  readonly plain: unknown
}

interface Report {
  readonly divergences: ReadonlyArray<Divergence>
  readonly steps: number
  /** Steps that produced at least one node-level change, so a run that
   *  compared two empty panels cannot pass for a comparison. */
  readonly changed: number
  /** Steps that produced at least one row that is not a served outline. */
  readonly others: number
  /** Steps where an outline could not be read on one side or the other. */
  readonly unreadable: number
  /** How many times HEAD moved under the session — the generation changes,
   *  which is the whole of what a cache here can get wrong. */
  readonly generations: number
  /** Steps the remembered arm answered with no file read at all. */
  readonly free: number
  /** Subprocesses each arm spent on the committed side over the session. */
  readonly cachedSpawns: number
  readonly plainSpawns: number
}

/**
 * Drive one scripted session against both arms.
 *
 * ONE STORE for both, deliberately: the working side of the comparison is the
 * store's own last-good parse, so two stores would be two readings of the disk
 * and a divergence could mean nothing worse than one of them having refreshed
 * first. What is under test is the COMMITTED side.
 *
 * THE CACHED ARM ASKS FIRST at every step, which is the order that can fail:
 * an arm that re-reads cannot be wrong, so the remembered one has to commit to
 * an answer before the reference produces the one it is held to.
 */
const replay = (
  files: Readonly<Record<string, string>>,
  script: (session: Session) => ReadonlyArray<Step>,
  options: { readonly serve?: string; readonly seed?: boolean } = {},
): Promise<Report> =>
  withArms(files, options, (arms) =>
    Effect.gen(function*() {
      const steps = script(arms.session)
      const divergences: Array<Divergence> = []
      let changed = 0
      let others = 0
      let unreadable = 0
      let generations = 0
      let free = 0
      /** Running totals: the counters are read and zeroed PER STEP — what a
       *  keystroke costs is the number the change is about — so the session's
       *  total is added up here rather than read off the wrapper at the end. */
      let cachedSpawns = 0
      let plainSpawns = 0
      let head = arms.head()

      for (const step of steps) {
        yield* Effect.sync(step.run)
        yield* arms.settle

        const now = arms.head()
        if (now !== head) {
          head = now
          generations++
        }

        arms.reset()
        const one = yield* arms.cached.status
        const two = yield* arms.plain.status
        cachedSpawns += arms.cachedSide.spawns()
        plainSpawns += arms.plainSide.spawns()
        if (arms.cachedSide.shows() === 0) free++
        if (one.pending.changes.length > 0) changed++
        if (one.pending.others.length > 0) others++
        if (one.pending.unreadable.length > 0) unreadable++

        // AN EQUALITY OF THE WHOLE ANSWER rather than of the field this change
        // touches: what a browser is handed is one value, and a cache that got
        // the changes right and the message wrong would be a cache that shipped.
        if (JSON.stringify(one) !== JSON.stringify(two)) {
          divergences.push({ step: step.name, cached: one, plain: two })
        }
      }

      return {
        divergences,
        steps: steps.length,
        changed,
        others,
        unreadable,
        generations,
        free,
        cachedSpawns,
        plainSpawns,
      }
    }))


/**
 * The session itself — the roadmap node's own list, in the order that makes
 * each step land on the state the one before it left.
 *
 * `at` is where the served directory sits from the repository root, so the same
 * script runs against a repository olai serves the root of and against one it
 * serves a subdirectory of — which is the case where every file has two
 * spellings and where a rename can arrive from OUTSIDE the served set.
 */
const script = (at: string) => (session: Session): ReadonlyArray<Step> => {
  const { git, remove, write } = session
  const served = (file: string): string => `${at}${file}`
  return [
    { name: "clean, nothing waiting", run: () => {} },
    {
      name: "one outline edited — the first revision, which owes a read",
      run: () => write(served("house.org"), HOUSE.replace("order the cabinets", "order cabinets")),
    },
    {
      name: "a keystroke in the same outline — nothing new to read",
      run: () => write(served("house.org"), HOUSE.replace("order the cabinets", "order oak")),
    },
    {
      name: "a second outline joins the dirty list",
      run: () => write(served("garden.org"), GARDEN.replace("build the beds", "build raised beds")),
    },
    {
      name: "a keystroke while two are waiting",
      run: () => write(served("house.org"), HOUSE.replace("install them", "install them all")),
    },
    {
      name: "a document edited by hand — a row that is not an outline",
      run: () => write("notes.md", "edited in vim\n"),
    },
    {
      name: "an outline that git has never seen",
      run: () => write(served("shed.org"), SHED),
    },
    {
      name: "an edit made outside olai, in a file already waiting",
      run: () => write(served("garden.org"), GARDEN.replace("Garden", "The garden")),
    },
    {
      name: "the working copy of one outline stops parsing",
      run: () => write(served("garden.org"), "this is not a node\n"),
    },
    { name: "... and mends", run: () => write(served("garden.org"), GARDEN) },
    {
      name: "a commit lands: HEAD moves, the working tree does not",
      run: () => {
        git("add", "-A")
        git("commit", "--quiet", "-m", "olai: the first half")
      },
    },
    {
      name: "an edit after the commit — a generation nobody has read yet",
      run: () => write(served("house.org"), HOUSE.replace("Kitchen remodel", "Kitchen")),
    },
    {
      name: "the commit is amended: HEAD moves, no byte on disk does",
      run: () => git("commit", "--quiet", "--amend", "-m", "olai: the first half, again"),
    },
    {
      name: "a keystroke on the amended generation",
      run: () => write(served("house.org"), HOUSE.replace("Kitchen remodel", "The kitchen")),
    },
    {
      // THE INDEX CORNERS, three steps of one file. `git show` reads the object
      // store, so none of this is an input to either arm — what these move is
      // the dirty list and the working side, both of which are taken fresh.
      name: "an outline is restored out of HEAD, and stops waiting",
      run: () => git("checkout", "--quiet", "HEAD", "--", served("house.org")),
    },
    {
      name: "... and out of an OLDER commit, which stages content and dirties it again",
      run: () => git("checkout", "--quiet", "HEAD~1", "--", served("house.org")),
    },
    {
      name: "an outline is staged and then edited again",
      run: () => {
        git("add", "--", served("house.org"))
        write(served("house.org"), HOUSE.replace("Kitchen remodel", "Kitchen, staged and moved on"))
      },
    },
    {
      name: "an outline is renamed inside the served set",
      run: () => {
        git("add", "-A")
        git("commit", "--quiet", "-m", "olai: before the rename")
        git("mv", served("garden.org"), served("yard.org"))
        write(served("yard.org"), GARDEN.replace("Garden", "The yard"))
      },
    },
    {
      name: "a keystroke while a rename is waiting",
      run: () => write(served("house.org"), HOUSE.replace("install them", "install the doors")),
    },
    {
      name: "a `.md` is renamed INTO the format — no committed outline to compare",
      run: () => {
        git("mv", "notes.md", served("notes.org"))
        write(served("notes.org"), outline(`{"id":"note","ord":"a0","title":"a note"}`))
      },
    },
    {
      name: "an outline leaves the disk",
      run: () => remove(served("shed.org")),
    },
    {
      name: "everything waiting is committed",
      run: () => {
        git("add", "-A")
        git("commit", "--quiet", "-m", "olai: the rest")
      },
    },
    {
      name: "`reset --soft` — back to a commit this session has already been on",
      run: () => git("reset", "--quiet", "--soft", "HEAD~1"),
    },
    {
      name: "a keystroke on the sha the session started from",
      run: () => write(served("house.org"), HOUSE.replace("Kitchen remodel", "Kitchen again")),
    },
    {
      name: "another branch is checked out: HEAD and the working tree move together",
      run: () => {
        git("checkout", "--quiet", "-f", "-B", "other", "HEAD~1")
        write(served("house.org"), HOUSE.replace("order the cabinets", "order on the other branch"))
      },
    },
    {
      name: "... and back to where it was",
      run: () => {
        git("checkout", "--quiet", "-f", "main")
        write(served("house.org"), HOUSE.replace("Kitchen remodel", "Kitchen, back on main"))
      },
    },
    {
      name: "a last keystroke, on the branch the session began on",
      run: () => write(served("house.org"), HOUSE.replace("install them", "install them now")),
    },
  ]
}

/** The gate, in one place: no divergence, and the run was not vacuous — both
 *  arms have to have been reached, and a session where nothing was ever waiting
 *  proves the equivalence of two empty panels. */
const holds = (report: Report): void => {
  expect(report.divergences).toEqual([])
  expect(report.changed).toBeGreaterThan(8)
  expect(report.others).toBeGreaterThan(2)
  expect(report.unreadable).toBeGreaterThan(0)
  expect(report.generations).toBeGreaterThan(4)
  // THE WIN, as a fact about the session rather than as a timing: most steps
  // cost the remembered arm no file read at all, and it spent strictly fewer
  // subprocesses than re-reading did over the same script.
  expect(report.free).toBeGreaterThanOrEqual(report.steps / 2)
  expect(report.cachedSpawns).toBeLessThan(report.plainSpawns)
}

test("a scripted git session answers what re-reading HEAD answers, at every step", async () => {
  holds(
    await replay(
      { "house.org": HOUSE, "garden.org": GARDEN, "notes.md": "as it was\n" },
      script(""),
    ),
  )
}, 30_000)

/** The same script one directory down, where a served name and a repository
 *  name are two different strings and the `.md` that is renamed into the format
 *  arrives from outside the served set. */
test("... and the same session in a served subdirectory", async () => {
  holds(
    await replay(
      { "docs/house.org": HOUSE, "docs/garden.org": GARDEN, "notes.md": "as it was\n" },
      script("docs/"),
      { serve: "docs" },
    ),
  )
}, 30_000)

/**
 * A repository whose first commit has not been made.
 *
 * There is no committed side at all here, and the two arms reach that by
 * different roads: the reference asks `git show HEAD:<file>` per file and is
 * refused per file, while the remembered one asks which commit HEAD names, is
 * told none, and answers for every path at once. Same panel, and every node in
 * the directory reads as created.
 */
test("a repository with no commits yet has no committed side, on both arms", async () => {
  const report = await replay(
    { "house.org": HOUSE },
    ({ write, git }) => [
      { name: "nothing has ever been committed", run: () => {} },
      { name: "a second outline arrives", run: () => write("garden.org", GARDEN) },
      {
        name: "an edit before the first commit",
        run: () => write("house.org", HOUSE.replace("Kitchen remodel", "Kitchen")),
      },
      {
        name: "the first commit lands",
        run: () => {
          git("add", "-A")
          git("commit", "--quiet", "-m", "olai: the first")
        },
      },
      {
        name: "an edit on the other side of the first commit",
        run: () => write("house.org", HOUSE.replace("install them", "install them now")),
      },
    ],
    { seed: false },
  )
  expect(report.divergences).toEqual([])
  // Every node of every file reads as created before that first commit, which
  // is what a directory with no history is.
  expect(report.changed).toBeGreaterThan(3)
  expect(report.generations).toBeGreaterThan(0)
}, 30_000)

/**
 * WHAT A KEYSTROKE COSTS, as an assertion.
 *
 * This is the roadmap node's actual complaint: not that the answer was wrong,
 * but that the bill grew with the dirty list, so a person who deferred a commit
 * paid more for every keystroke than the person who had just made one. The
 * numbers below are exact rather than bounded, because "O(1)" written as
 * `toBeLessThan(50)` is a test that would pass a regression back to O(N/2).
 *
 * The subprocesses counted are the COMMITTED SIDE's — the `rev-parse` that
 * names the commit and every `show` under it. The rest of a survey is three
 * subprocesses (`status`, `symbolic-ref`, `log`) that take no per-file argument
 * and cannot grow with the dirty list; this change does not touch them.
 */
test("a keystroke costs one subprocess with fifty outlines waiting, not fifty", async () => {
  const HOW_MANY = 50
  const files: Record<string, string> = { "house.org": HOUSE }
  for (let at = 0; at < HOW_MANY; at++) {
    files[`file${at}.org`] = outline(`{"id":"n${at}","ord":"a0","title":"node ${at}"}`)
  }

  await withArms(files, {}, (arms) =>
    Effect.gen(function*() {
      const { cached, cachedSide, plain, plainSide, session } = arms
      const dirty = (at: number, title: string) =>
        session.write(`file${at}.org`, outline(`{"id":"n${at}","ord":"a0","title":"${title}"}`))

      // FIFTY WAITING, which under manual commit is an ordinary afternoon.
      for (let at = 0; at < HOW_MANY; at++) dirty(at, `edited ${at}`)
      yield* arms.settle
      arms.reset()
      yield* cached.status
      yield* plain.status
      // The first survey of a generation owes a read for every dirty outline,
      // on both arms — the cache is a memory, not a divination — plus the one
      // `rev-parse` that says which commit it may remember them under.
      expect(cachedSide.shows()).toBe(HOW_MANY)
      expect(cachedSide.spawns()).toBe(HOW_MANY + 1)
      expect(plainSide.shows()).toBe(HOW_MANY)

      // ONE KEYSTROKE, in a file that is already waiting. THE NUMBER THIS
      // CHANGE IS ABOUT.
      dirty(0, "one more keystroke")
      yield* arms.settle
      arms.reset()
      const one = yield* cached.status
      const two = yield* plain.status
      expect(cachedSide.shows()).toBe(0)
      expect(cachedSide.spawns()).toBe(1)
      expect(plainSide.shows()).toBe(HOW_MANY)
      expect(JSON.stringify(one)).toBe(JSON.stringify(two))

      // ... and it does not matter how many are waiting: ten more keystrokes,
      // still one subprocess each.
      for (let at = 0; at < 10; at++) {
        dirty(at, `keystroke ${at}`)
        yield* arms.settle
        arms.reset()
        yield* cached.status
        expect(cachedSide.spawns()).toBe(1)
      }

      // A FILE THAT HAS JUST BECOME DIRTY is the one revision that still owes a
      // read, and it owes exactly one.
      session.write("newcomer.org", outline(`{"id":"new","ord":"a0","title":"new"}`))
      yield* arms.settle
      arms.reset()
      yield* cached.status
      expect(cachedSide.shows()).toBe(1)
      expect(cachedSide.spawns()).toBe(2)

      // A COMMIT MOVES HEAD, so the generation goes and what is still waiting
      // is read again — once each, and once only.
      session.git("add", "file0.org")
      session.git("commit", "--quiet", "-m", "olai: one of them")
      yield* arms.settle
      arms.reset()
      const after = yield* cached.status
      const alsoAfter = yield* plain.status
      expect(cachedSide.shows()).toBe(HOW_MANY)
      expect(JSON.stringify(after)).toBe(JSON.stringify(alsoAfter))
      // ... and the revision after that owes nothing again.
      dirty(1, "after the commit")
      yield* arms.settle
      arms.reset()
      yield* cached.status
      expect(cachedSide.spawns()).toBe(1)
    }))
}, 30_000)
