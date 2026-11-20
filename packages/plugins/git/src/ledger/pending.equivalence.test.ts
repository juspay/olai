import { expect, test } from "bun:test"
import { Effect } from "effect"

import { outline, type Session, withArms } from "./pending.testlib.ts"

// Every step of this differential spawns real git on both arms; bun's default
// per-test budget is five seconds.
const SESSION_TIMEOUT = 30_000

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

interface Step {
  readonly name: string
  readonly run: () => void
}

interface Divergence {
  readonly step: string
  readonly cached: unknown
  readonly plain: unknown
}

interface Report {
  readonly divergences: ReadonlyArray<Divergence>
  readonly steps: number
  readonly changed: number
  readonly others: number
  readonly unreadable: number
  readonly generations: number
  readonly free: number
  readonly cachedSpawns: number
  readonly plainSpawns: number
}

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


const script = (at: string) => (session: Session): ReadonlyArray<Step> => {
  const { git, remove, write } = session
  const served = (file: string): string => `${at}${file}`
  return [
    { name: "clean, nothing waiting", run: () => {} },
    {
      name: "one outline edited — the first revision, which owes a read",
      run: () => write(served("house.olai"), HOUSE.replace("order the cabinets", "order cabinets")),
    },
    {
      name: "a keystroke in the same outline — nothing new to read",
      run: () => write(served("house.olai"), HOUSE.replace("order the cabinets", "order oak")),
    },
    {
      name: "a second outline joins the dirty list",
      run: () => write(served("garden.olai"), GARDEN.replace("build the beds", "build raised beds")),
    },
    {
      name: "a keystroke while two are waiting",
      run: () => write(served("house.olai"), HOUSE.replace("install them", "install them all")),
    },
    {
      name: "a document edited by hand — a row that is not an outline",
      run: () => write("notes.md", "edited in vim\n"),
    },
    {
      name: "an outline that git has never seen",
      run: () => write(served("shed.olai"), SHED),
    },
    {
      name: "an edit made outside olai, in a file already waiting",
      run: () => write(served("garden.olai"), GARDEN.replace("Garden", "The garden")),
    },
    {
      name: "the working copy of one outline stops parsing",
      run: () => write(served("garden.olai"), "this is not a node\n"),
    },
    { name: "... and mends", run: () => write(served("garden.olai"), GARDEN) },
    {
      name: "a commit lands: HEAD moves, the working tree does not",
      run: () => {
        git("add", "-A")
        git("commit", "--quiet", "-m", "olai: the first half")
      },
    },
    {
      name: "an edit after the commit — a generation nobody has read yet",
      run: () => write(served("house.olai"), HOUSE.replace("Kitchen remodel", "Kitchen")),
    },
    {
      name: "the commit is amended: HEAD moves, no byte on disk does",
      run: () => git("commit", "--quiet", "--amend", "-m", "olai: the first half, again"),
    },
    {
      name: "a keystroke on the amended generation",
      run: () => write(served("house.olai"), HOUSE.replace("Kitchen remodel", "The kitchen")),
    },
    {
      name: "an outline is restored out of HEAD, and stops waiting",
      run: () => git("checkout", "--quiet", "HEAD", "--", served("house.olai")),
    },
    {
      name: "... and out of an OLDER commit, which stages content and dirties it again",
      run: () => git("checkout", "--quiet", "HEAD~1", "--", served("house.olai")),
    },
    {
      name: "an outline is staged and then edited again",
      run: () => {
        git("add", "--", served("house.olai"))
        write(served("house.olai"), HOUSE.replace("Kitchen remodel", "Kitchen, staged and moved on"))
      },
    },
    {
      name: "an outline is renamed inside the served set",
      run: () => {
        git("add", "-A")
        git("commit", "--quiet", "-m", "olai: before the rename")
        git("mv", served("garden.olai"), served("yard.olai"))
        write(served("yard.olai"), GARDEN.replace("Garden", "The yard"))
      },
    },
    {
      name: "a keystroke while a rename is waiting",
      run: () => write(served("house.olai"), HOUSE.replace("install them", "install the doors")),
    },
    {
      name: "a `.md` is renamed INTO the format — no committed outline to compare",
      run: () => {
        git("mv", "notes.md", served("notes.olai"))
        write(served("notes.olai"), outline(`{"id":"note","ord":"a0","title":"a note"}`))
      },
    },
    {
      name: "an outline leaves the disk",
      run: () => remove(served("shed.olai")),
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
      run: () => write(served("house.olai"), HOUSE.replace("Kitchen remodel", "Kitchen again")),
    },
    {
      name: "another branch is checked out: HEAD and the working tree move together",
      run: () => {
        git("checkout", "--quiet", "-f", "-B", "other", "HEAD~1")
        write(served("house.olai"), HOUSE.replace("order the cabinets", "order on the other branch"))
      },
    },
    {
      name: "... and back to where it was",
      run: () => {
        git("checkout", "--quiet", "-f", "main")
        write(served("house.olai"), HOUSE.replace("Kitchen remodel", "Kitchen, back on main"))
      },
    },
    {
      name: "a last keystroke, on the branch the session began on",
      run: () => write(served("house.olai"), HOUSE.replace("install them", "install them now")),
    },
  ]
}

const holds = (report: Report): void => {
  expect(report.divergences).toEqual([])
  expect(report.changed).toBeGreaterThan(8)
  expect(report.others).toBeGreaterThan(2)
  expect(report.unreadable).toBeGreaterThan(0)
  expect(report.generations).toBeGreaterThan(4)
  expect(report.free).toBeGreaterThanOrEqual(report.steps / 2)
  expect(report.cachedSpawns).toBeLessThan(report.plainSpawns)
}

test("a scripted git session answers what re-reading HEAD answers, at every step", async () => {
  holds(
    await replay(
      { "house.olai": HOUSE, "garden.olai": GARDEN, "notes.md": "as it was\n" },
      script(""),
    ),
  )
}, { timeout: SESSION_TIMEOUT })

test("... and the same session in a served subdirectory", async () => {
  holds(
    await replay(
      { "docs/house.olai": HOUSE, "docs/garden.olai": GARDEN, "notes.md": "as it was\n" },
      script("docs/"),
      { serve: "docs" },
    ),
  )
}, { timeout: SESSION_TIMEOUT })

test("a repository with no commits yet has no committed side, on both arms", async () => {
  const report = await replay(
    { "house.olai": HOUSE },
    ({ write, git }) => [
      { name: "nothing has ever been committed", run: () => {} },
      { name: "a second outline arrives", run: () => write("garden.olai", GARDEN) },
      {
        name: "an edit before the first commit",
        run: () => write("house.olai", HOUSE.replace("Kitchen remodel", "Kitchen")),
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
        run: () => write("house.olai", HOUSE.replace("install them", "install them now")),
      },
    ],
    { seed: false },
  )
  expect(report.divergences).toEqual([])
  expect(report.changed).toBeGreaterThan(3)
  expect(report.generations).toBeGreaterThan(0)
})

test("a keystroke costs one subprocess with fifty outlines waiting, not fifty", async () => {
  const HOW_MANY = 50
  const files: Record<string, string> = { "house.olai": HOUSE }
  for (let at = 0; at < HOW_MANY; at++) {
    files[`file${at}.olai`] = outline(`{"id":"n${at}","ord":"a0","title":"node ${at}"}`)
  }

  await withArms(files, {}, (arms) =>
    Effect.gen(function*() {
      const { cached, cachedSide, plain, plainSide, session } = arms
      const dirty = (at: number, title: string) =>
        session.write(`file${at}.olai`, outline(`{"id":"n${at}","ord":"a0","title":"${title}"}`))

      for (let at = 0; at < HOW_MANY; at++) dirty(at, `edited ${at}`)
      yield* arms.settle
      arms.reset()
      yield* cached.status
      yield* plain.status
      expect(cachedSide.shows()).toBe(HOW_MANY)
      expect(cachedSide.spawns()).toBe(HOW_MANY + 1)
      expect(plainSide.shows()).toBe(HOW_MANY)

      dirty(0, "one more keystroke")
      yield* arms.settle
      arms.reset()
      const one = yield* cached.status
      const two = yield* plain.status
      expect(cachedSide.shows()).toBe(0)
      expect(cachedSide.spawns()).toBe(1)
      expect(plainSide.shows()).toBe(HOW_MANY)
      expect(JSON.stringify(one)).toBe(JSON.stringify(two))

      for (let at = 0; at < 10; at++) {
        dirty(at, `keystroke ${at}`)
        yield* arms.settle
        arms.reset()
        yield* cached.status
        expect(cachedSide.spawns()).toBe(1)
      }

      session.write("newcomer.olai", outline(`{"id":"new","ord":"a0","title":"new"}`))
      yield* arms.settle
      arms.reset()
      yield* cached.status
      expect(cachedSide.shows()).toBe(1)
      expect(cachedSide.spawns()).toBe(2)

      session.git("add", "file0.olai")
      session.git("commit", "--quiet", "-m", "olai: one of them")
      yield* arms.settle
      arms.reset()
      const after = yield* cached.status
      const alsoAfter = yield* plain.status
      expect(cachedSide.shows()).toBe(HOW_MANY)
      expect(JSON.stringify(after)).toBe(JSON.stringify(alsoAfter))
      dirty(1, "after the commit")
      yield* arms.settle
      arms.reset()
      yield* cached.status
      expect(cachedSide.spawns()).toBe(1)
    }))
})
