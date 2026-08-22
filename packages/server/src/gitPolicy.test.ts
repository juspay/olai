/**
 * `--commit` and `--push`, on both faces, as a truth table and a fence.
 *
 * Two different claims are held here and they are worth telling apart.
 *
 * The TRUTH TABLE is about one function: what `--commit=X`, `--no-commit` and
 * `--push=X` come to between them, including the case where a person typed both
 * of the first two. That is pure, so it is asserted as values rather than by
 * starting a process.
 *
 * What it answers with is a PIN rather than a mode, and that distinction is the
 * whole of `vault-level-settings`: a flag NOBODY GAVE is `null`, which leaves
 * every browser's own preference alone, while `--commit=manual` typed out loud
 * freezes that row read-only in every browser. The two do the same thing on
 * this server and opposite things in front of a reader, so a table that folded
 * them together would be a table that cannot see the feature.
 *
 * The FENCE is about the two faces, and it is the one this file exists for.
 * the agent face shipped without the flag at all — the tri-state was `olai web`'s
 * alone, so an MCP-driven session could not batch and put four commits into a
 * human's log in fifteen seconds. Nothing failed, because nothing compared the
 * two faces. These tests do: every mode and the default are asserted present on
 * both, and the sentence is asserted to differ in exactly the one clause that is
 * allowed to — which door asks for the commit. A face that quietly grew a fourth
 * mode, lost the default, or started describing a button a terminal has no way
 * to press fails here.
 */

import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import {
  COMMIT_DEFAULT,
  COMMIT_MODES,
  DEFAULT_POLICY,
  NO_PIN,
  policyOf,
  PUSH_DEFAULT,
  PUSH_MODES,
} from "@olai/format"
import { COMMIT_BUTTON, commitDoors, COMMIT_TOOL } from "@olai/ops"
import { Effect, Result } from "effect"
import { BOOT_TIMEOUT, startWeb } from "./child.testlib.ts"
import { commitsSaid, gitPin, openPolicy, pushesSaid } from "./gitPolicy.ts"
import { served } from "./serve.testlib.ts"

// ── what the flags come to between them ────────────────────────────────

/**
 * THE DEFAULT IS AN ABSENCE, and that is the claim this whole feature rests on.
 *
 * A server nobody gave a git flag to pins nothing, so both preference rows stay
 * live in every browser exactly as they shipped. It still commits manually —
 * that is `policyOf` filling the defaults back in — and the two facts are
 * deliberately separate values here rather than one.
 */
test("no flag at all pins nothing, and the server still commits manually", () => {
  expect(gitPin(null, false, null)).toEqual(NO_PIN)
  expect(policyOf(gitPin(null, false, null)).commit).toBe(COMMIT_DEFAULT)
})

/**
 * ... and the same mode TYPED OUT LOUD is a pin.
 *
 * `--commit=manual` and saying nothing make this process behave identically and
 * every browser behave oppositely: one freezes the Git commit row read-only for
 * everyone, the other leaves it alone. Folding the two into one `CommitMode`
 * is exactly the bug this test exists to keep out.
 */
test("a mode given out loud is a pin, even when it is the default one", () => {
  expect(gitPin("manual", false, null).commit).toBe("manual")
  expect(policyOf(gitPin("manual", false, null)).commit).toBe("manual")
})

test("each mode passes through when it is the only thing said", () => {
  for (const mode of COMMIT_MODES) {
    expect(gitPin(mode, false, null).commit).toBe(mode)
    expect(policyOf(gitPin(mode, false, null)).commit).toBe(mode)
  }
  for (const mode of PUSH_MODES) {
    expect(gitPin(null, false, mode).push).toBe(mode)
  }
})

/** The two halves are independent: pinning one leaves the other unpinned, so an
 *  operator who ruled on committing has not accidentally ruled on pushing. */
test("pinning one flag does not pin the other", () => {
  expect(gitPin("auto", false, null)).toEqual({ commit: "auto", push: null })
  expect(gitPin(null, false, "off")).toEqual({ commit: null, push: "off" })
})

/**
 * The one case with a decision in it.
 *
 * A person who typed both said "off" once and something else once, and the
 * opt-out is the reading that cannot surprise them: honouring `--commit=auto`
 * would write to a history they had asked olai to stay out of, which is the one
 * mistake here that trying again does not undo. It PINS, exactly as
 * `--commit=off` does — the two are one flag with two spellings, and a browser
 * whose preferences depended on which one the operator likes to type would be
 * a browser nobody can reason about.
 */
test("--no-commit wins over every mode, because it is the one that turns something off", () => {
  for (const mode of COMMIT_MODES) {
    expect(gitPin(mode, true, null).commit).toBe("off")
  }
  expect(gitPin(null, true, null).commit).toBe("off")
})

test("the modes are exactly three, and `off` is what --no-commit means", () => {
  expect([...COMMIT_MODES]).toEqual(["off", "manual", "auto"])
})

/** `--push` has two and deliberately not three: a `manual` beside this `off`
 *  would be two names for one behaviour. */
test("the push modes are exactly two", () => {
  expect([...PUSH_MODES]).toEqual(["off", "auto"])
})

/** Both flags say out loud that GIVING them is a decision about every browser,
 *  because that is the thing an operator most needs to know before typing one
 *  and the only place they will be told is `--help`. */
test("both flags say that giving them pins the row in every browser", () => {
  for (const said of [commitsSaid("web"), commitsSaid("mcp"), pushesSaid()]) {
    expect(said).toContain("PINS")
    expect(said).toContain("read-only")
  }
})

test("--push names both of its modes and its default", () => {
  const said = pushesSaid()
  for (const mode of PUSH_MODES) expect(said).toContain(mode)
  expect(said).toContain("the default")
})

// ── the two faces do not diverge ───────────────────────────────────────

test("both faces advertise every mode, so neither can quietly grow or lose one", () => {
  for (const face of ["web", "mcp"] as const) {
    const said = commitsSaid(face)
    for (const mode of COMMIT_MODES) expect(said).toContain(mode)
    // The default is stated, not left to be discovered by running it.
    expect(said).toContain("the default")
  }
})

/**
 * Each face names every door it actually has — no more, and NO FEWER.
 *
 * The "no fewer" half is the one that was got wrong. `olai web` hands its own
 * panel agent the same `commit` tool an outside agent gets, so a web serve
 * really does have both doors, and a help text naming only the button leaves out
 * something true. A terminal agent has no browser, so naming the button there sends a
 * person after a control they have not got. Both are the same mistake pointed
 * two ways, and only asserting the exact SET catches both — an earlier version
 * of this test compared the two sentences modulo one substitution, which could
 * never have noticed web under-describing itself.
 *
 * The phrases come from the one table rather than being spelled again here: a
 * test carrying its own copy of the thing under test is the drift it exists to
 * catch, one layer up.
 */
test("each face names every door it has, and no door it has not", () => {
  const named = (said: string) =>
    [COMMIT_BUTTON, COMMIT_TOOL].filter((door) => said.includes(door)).sort()

  // The browser: a button, and the tool its own panel agent is handed.
  expect(named(commitsSaid("web"))).toEqual([COMMIT_BUTTON, COMMIT_TOOL].sort())
  // A terminal: the tool, and nothing to press.
  expect(named(commitsSaid("mcp"))).toEqual([COMMIT_TOOL])
})

/** And the rest of the sentence is one rule described once — everything either
 *  face says apart from its doors is the same words, so a second divergence
 *  sneaking into the wording fails here. */
test("apart from the doors, both faces say the same thing", () => {
  const withoutDoors = (face: "web" | "mcp") =>
    commitsSaid(face).replace(commitDoors(face), "…")
  expect(withoutDoors("web")).toBe(withoutDoors("mcp"))
})

/**
 * The parse-time half of "opt-out", which the truth table cannot see.
 *
 * Effect 4's `Flag.boolean` treats omission as a missing required flag unless
 * it has a fallback. `--no-commit` is the opt-out: a person (and the e2e git
 * scenarios) who want the default pass nothing. Spawning, not parsing in
 * process, because that is the seam the CLI library owns and the unit tests
 * of `gitPin` never touch.
 */
test("olai web without --no-commit still boots", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "olai-commit-run-"))
  const server = startWeb({
    root: served(),
    extra: [],
    env: { XDG_RUNTIME_DIR: runtime },
  })
  try {
    const url = await server.address()
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    expect(server.said()).not.toContain("Missing required flag")
  } finally {
    server.kill()
  }
}, BOOT_TIMEOUT * 3)

// ── what is remembered, and where ──────────────────────────────────────

/**
 * The policy the preference rows now set, and the file it survives a restart
 * in.
 *
 * OUTSIDE THE VAULT is the ruling (#335, and again for
 * `git-policy-server-side`): a settings file under the served directory would
 * travel with `git pull`, so a personal clone of a team's outlines would
 * inherit the team's auto-push. So each of these points `XDG_STATE_HOME` at a
 * temp directory of its own, looks in it, and holds that the served directory
 * itself is untouched.
 */
const withState = async <A>(use: (dirs: {
  readonly root: string
  readonly state: string
}) => Promise<A>): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-policy-root-")))
  const state = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-policy-state-")))
  const before = process.env["XDG_STATE_HOME"]
  process.env["XDG_STATE_HOME"] = state
  try {
    return await use({ root, state })
  } finally {
    if (before === undefined) delete process.env["XDG_STATE_HOME"]
    else process.env["XDG_STATE_HOME"] = before
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(state, { recursive: true, force: true })
  }
}

/** Every file under a directory, so a test can say what was written and,
 *  more to the point, what was NOT. */
const filesUnder = (at: string): ReadonlyArray<string> =>
  fs.existsSync(at)
    ? fs.readdirSync(at, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(String(entry.parentPath ?? at), entry.name))
    : []

test("a directory nobody has chosen for runs on the flags and the defaults", () =>
  withState(async ({ root }) => {
    const policy = await Effect.runPromise(openPolicy(root, NO_PIN))
    expect(policy.now()).toEqual(DEFAULT_POLICY)
    expect(policy.pin).toEqual(NO_PIN)
  }))

test("a choice is remembered outside the vault, and a second server reads it back", () =>
  withState(async ({ root, state }) => {
    const first = await Effect.runPromise(openPolicy(root, NO_PIN))
    expect(await Effect.runPromise(first.set({ commit: "auto" })))
      .toEqual({ commit: "auto", push: PUSH_DEFAULT })

    // NOTHING IN THE VAULT. This is the whole ruling, as an assertion: a file
    // here would be committed, and then pulled into somebody's personal clone.
    expect(filesUnder(root)).toEqual([])
    // ... and it IS somewhere, under the state home, saying which directory it
    // is about so a person reading their own state directory can tell.
    const written = filesUnder(path.join(state, "olai", "git"))
    expect(written).toHaveLength(1)
    expect(JSON.parse(fs.readFileSync(written[0] ?? "", "utf8"))).toMatchObject({
      cwd: root,
      commit: "auto",
    })

    // A RESTART: a fresh policy over the same directory, which is what the next
    // boot of the server does.
    const second = await Effect.runPromise(openPolicy(root, NO_PIN))
    expect(second.now()).toEqual({ commit: "auto", push: PUSH_DEFAULT })
  }))

test("each half moves on its own, so setting one does not reset the other", () =>
  withState(async ({ root }) => {
    const policy = await Effect.runPromise(openPolicy(root, NO_PIN))
    await Effect.runPromise(policy.set({ commit: "auto" }))
    expect(await Effect.runPromise(policy.set({ push: "auto" })))
      .toEqual({ commit: "auto", push: "auto" })
  }))

/**
 * THE PIN WINS, and a browser that asks anyway is REFUSED.
 *
 * A read-only control that could be bypassed by the procedure behind it would
 * be `vault-level-settings` honoured in the drawing and not in the doing —
 * which is exactly the failure the pin exists to prevent, wearing a nicer
 * shirt.
 */
test("a pinned half overrules what was remembered, and refuses to be set", () =>
  withState(async ({ root }) => {
    const chose = await Effect.runPromise(openPolicy(root, NO_PIN))
    await Effect.runPromise(chose.set({ commit: "auto", push: "auto" }))

    const pinned = await Effect.runPromise(
      openPolicy(root, { commit: "manual", push: null }),
    )
    // The flag wins over the remembered choice for its own half, and leaves the
    // other one exactly where the reader put it.
    expect(pinned.now()).toEqual({ commit: "manual", push: "auto" })

    const refused = await Effect.runPromise(
      Effect.result(pinned.set({ commit: "auto" })),
    )
    expect(Result.isFailure(refused)).toBe(true)
    if (Result.isFailure(refused)) {
      expect(refused.failure.message).toContain("--commit=manual")
    }
    // ... and the unpinned half is still live on the same server.
    expect(await Effect.runPromise(pinned.set({ push: "off" })))
      .toEqual({ commit: "manual", push: "off" })
  }))

/** A file about some OTHER directory is not this one's memory. It is not damage
 *  either — a digest collision, or a state directory somebody copied — so the
 *  honest answer is that nothing here says. */
test("a remembered file about another directory is ignored", () =>
  withState(async ({ root, state }) => {
    const policy = await Effect.runPromise(openPolicy(root, NO_PIN))
    await Effect.runPromise(policy.set({ commit: "auto" }))
    const written = filesUnder(path.join(state, "olai", "git"))[0] ?? ""
    fs.writeFileSync(
      written,
      JSON.stringify({ cwd: "/somewhere/else", commit: "auto" }),
    )
    expect((await Effect.runPromise(openPolicy(root, NO_PIN))).now())
      .toEqual(DEFAULT_POLICY)
  }))

/** Damage costs the setting and never the serve: a file that will not parse
 *  leaves this directory on the flags and the defaults, and says so in the log
 *  rather than refusing to serve a directory of notes. */
test("a remembered file that will not parse leaves the defaults standing", () =>
  withState(async ({ root, state }) => {
    const policy = await Effect.runPromise(openPolicy(root, NO_PIN))
    await Effect.runPromise(policy.set({ commit: "auto" }))
    fs.writeFileSync(filesUnder(path.join(state, "olai", "git"))[0] ?? "", "{ not json")
    expect((await Effect.runPromise(openPolicy(root, NO_PIN))).now())
      .toEqual(DEFAULT_POLICY)
  }))

/** ... and a half that is not one of the modes is read as "nothing says",
 *  which costs that setting and not the other one. */
test("a remembered half that is not a mode reads as unsaid", () =>
  withState(async ({ root, state }) => {
    const policy = await Effect.runPromise(openPolicy(root, NO_PIN))
    await Effect.runPromise(policy.set({ commit: "auto", push: "auto" }))
    const written = filesUnder(path.join(state, "olai", "git"))[0] ?? ""
    fs.writeFileSync(written, JSON.stringify({ cwd: root, commit: "sideways", push: "auto" }))
    expect((await Effect.runPromise(openPolicy(root, NO_PIN))).now())
      .toEqual({ commit: COMMIT_DEFAULT, push: "auto" })
  }))
