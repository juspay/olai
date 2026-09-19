/**
 * DOES THE PINNED `himalaya` STILL ANSWER EVERY SUBCOMMAND THE MAIL PLUGIN
 * SPEAKS — asked of the binary the build bakes, not of a table this repo wrote.
 *
 * ## Why this exists as its own leg
 *
 * `packages/plugins/mail/src/himalaya/verbs.ts` freezes the spellings, and two
 * readers spend that table without being able to argue with it: `./run.ts`
 * composes the argv, and `../appliance/testlib/fake-himalaya.ts` answers
 * exactly those verbs and refuses anything else. Both are this repo's own
 * sentences about the pin, which is the only way to state what a scenario sees
 * — and it is also why neither can see the pin move. This is the same gap
 * `scripts/check-odu-surface.ts` was written for, one pin over, and there it
 * was not hypothetical: the bump to juspay/odu#105 renamed every verb the odu
 * probe asked for, every fixture in the tree kept answering the OLD names, and
 * a packaged olai drew "its tool surface is missing `run`" in every
 * conversation while `typecheck`, `test` and `nix` were green.
 *
 * So this leg asks the two questions the fixtures structurally cannot. It runs
 * the BUILT binary — the absolute path `default.nix` bakes as `OLAI_HIMALAYA` —
 * and demands:
 *
 *   - that its version is not below the floor (`HIMALAYA_VERSION_FLOOR`,
 *     imported and never restated here: the release that introduced the `gmail`
 *     backend, so a pin that slid back to 2.0.0 answers `unrecognized
 *     subcommand` to every verb below, and would otherwise be found by a
 *     person asking for their mail);
 *   - that every verb in `GMAIL_VERBS` answers `--help`. Clap answers an
 *     unknown subcommand on stderr with exit 2, so the exit status is the
 *     whole of the answer and no output has to be parsed;
 *   - that the ARGV the plugin composes is still this binary's argv, and that
 *     a failure still arrives the way `./run.ts` reads one. That is the one
 *     question the fixtures cannot answer at all, because the fake enforces
 *     this repo's belief about it: `himalayaArgv` puts the two GLOBAL flags
 *     (`-c`, `--json`) before the subcommand words, and the pinned binary
 *     answers a runtime failure as `{"error": …}` on STDOUT with a non-zero
 *     exit — two facts the plan for this plugin got wrong, and neither of them
 *     visible to a fake that was written from the same document. The leg runs
 *     the composed argv against a config path that does not exist: clap parses
 *     the flags first (a moved or renamed global flag is a usage error, with
 *     nothing on stdout), and the binary then fails to read the config and
 *     answers the JSON envelope.
 *
 * There is no skip: a leg that passes when it could not find the binary is the
 * same silence again, one level up. Silence is also the SUCCESS output — the
 * recipe's stdout is CI output, and only failures are printed.
 *
 * ## Why a script and not a test file
 *
 * The binary's path is a build artifact somebody must ask nix for: no `himalaya`
 * belongs on a developer's PATH or in the dev shell, and the mail plugin's
 * `default.nix` builds the pin from `npins/sources.json` (Cargo, fenix, pimalaya),
 * which is not something a `bun test` run should pay. So the asking belongs in
 * the recipe (`just mail-surface`) that hands this script the directory, and it
 * takes exactly ONE argument — a directory holding `himalaya` — so a developer
 * can point it at a candidate pin by hand before moving the pin.
 *
 * WHAT A FAILURE HERE MEANS is one of two things, and the sentence names which:
 * either the pin moved past what this plugin's `run.ts` and its fakes were
 * written against — the plugin needs updating, and the failure names the verb —
 * or the pinned build is broken or too old, which is a pin problem rather than
 * a plugin one. Both are things a conversation would otherwise draw first.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { GMAIL, GMAIL_VERBS, HIMALAYA_VERSION_FLOOR, himalayaArgv } from "./verbs.ts"

const dir = process.argv[2]
if (dir === undefined || dir === "") {
  console.error("usage: check-himalaya-surface.ts <dir holding the pinned `himalaya`>")
  process.exit(2)
}

// THE BINARY IS EXACTLY THIS DIRECTORY'S, by absolute path and never a PATH
// lookup: the claim is about the pinned build, and a machine's own `himalaya`
// answering it instead would be the same confusion check-odu-surface.ts refuses
// on its side (a machine deciding a question the build is supposed to).
const binary = `${dir}/himalaya`

/**
 * One spawn of the pin, both streams captured as text.
 *
 * `node:child_process`'s `spawnSync` rather than `Bun.spawnSync` because a
 * MISSING or unexecutable binary is one of this leg's own answers: node hands it
 * back as `error` beside a null status, bun's throws, and a stack trace is not
 * the sentence somebody needs here.
 */
const ask = (args: ReadonlyArray<string>) => spawnSync(binary, args, { encoding: "utf8" })

/** The whole of this script's output: the failure, then out. Nothing else is
 *  ever printed, so a green run leaves CI's log with nothing to read. */
const fail = (lines: ReadonlyArray<string>): never => {
  for (const line of lines) console.error(line)
  process.exit(1)
}

/** The pin's version as three numbers, off `--version`'s FIRST line: 2.1.0
 *  prints that line, then its features, then `build:` and `git:` lines, and
 *  only the first carries the version. The leading `v` is the binary's. */
const readVersion = (line: string): readonly [number, number, number] | null => {
  const match = /^himalaya v(\d+)\.(\d+)\.(\d+)\b/.exec(line)
  if (match === null) return null
  const [major, minor, patch] = match.slice(1).map(Number)
  if (major === undefined || minor === undefined || patch === undefined) return null
  return [major, minor, patch]
}

const version = ask(["--version"])
if (version.error !== undefined || version.status !== 0) {
  fail([
    "check-himalaya-surface: the pinned `himalaya` did not answer `--version`",
    `  where: ${binary}`,
    `  why:   ${version.error?.message ?? `exited ${version.status}`}`,
    "",
    "This is the binary the mail plugin's `default.nix` builds, baked as",
    "OLAI_HIMALAYA. If it is not there, the pin did not build; if it answered",
    "with a status, something other than Himalaya is standing at that path.",
  ])
}

const firstLine = (version.stdout.split("\n")[0] ?? "").trim()
const found = readVersion(firstLine)
if (found === null) {
  fail([
    "check-himalaya-surface: the pinned `himalaya --version` printed no version on its first line",
    `  where:   ${binary}`,
    `  printed: ${firstLine === "" ? "(nothing)" : `\`${firstLine}\``}`,
    "",
    "The first line is the one this leg reads (`himalaya v2.1.0 +msgraph …`). A",
    "binary that no longer leads with `himalaya v<x.y.z>` is not the shape",
    "`packages/plugins/mail/src/himalaya/run.ts` was written against.",
  ])
}

const [major, minor, patch] = found as [number, number, number]
const [floorMajor, floorMinor, floorPatch] = HIMALAYA_VERSION_FLOOR
// Highest component first, and the first pair that differs is the whole answer —
// which is what comparing three version components is, spelled out rather than
// read as one decimal (`v2.10.0` is above `v2.9.9`, and `2.10 < 2.9` would be
// the wrong sentence about it).
const belowFloor =
  major !== floorMajor
    ? major < floorMajor
    : minor !== floorMinor
      ? minor < floorMinor
      : patch < floorPatch

if (belowFloor) {
  fail([
    "check-himalaya-surface: the pinned `himalaya` is below the floor this olai's mail row needs",
    `  has:   v${major}.${minor}.${patch}`,
    `  floor: v${floorMajor}.${floorMinor}.${floorPatch} — HIMALAYA_VERSION_FLOOR, in`,
    "         packages/plugins/mail/src/himalaya/verbs.ts",
    "",
    "The floor is the release that introduced the `gmail` backend this plugin",
    "speaks, so every verb below answers `error: unrecognized subcommand` — a",
    "conversation that cannot connect to Google and cannot say why. Move the pin",
    "back (npins/sources.json), or move the floor with the plugin if the surface",
    "is genuinely still there.",
  ])
}

// THE ARGV AND THE ENVELOPE, in one invocation: a config path that cannot
// exist makes the binary fail AFTER clap has parsed the global flags — so a
// `--json` that moved, or a `-c` that stopped being global, is a usage error
// (nothing on stdout) rather than the envelope this asserts.
const composed = ask(himalayaArgv("/nonexistent/olai-mail-surface-check.toml", GMAIL.profileGet.path, []))
const envelope = (() => {
  try {
    return JSON.parse(composed.stdout) as unknown
  } catch {
    return null
  }
})()
const said = typeof envelope === "object" && envelope !== null && typeof (envelope as { error?: unknown }).error === "string"
if (composed.status === 0 || !said) {
  fail([
    "check-himalaya-surface: the pinned `himalaya` no longer speaks the argv this plugin composes",
    `  argv: ${["himalaya", ...himalayaArgv("<config>", GMAIL.profileGet.path, [])].join(" ")}`,
    `  exit: ${composed.status ?? "no status"}`,
    `  stdout: ${composed.stdout.trim() === "" ? "(empty)" : composed.stdout.trim().slice(0, 200)}`,
    `  stderr: ${(composed.stderr.split("\n")[0] ?? "").trim().slice(0, 200) || "(empty)"}`,
    "",
    "`himalayaArgv` puts the two GLOBAL flags before the subcommand words and",
    "`run.ts` reads a refusal as `{\"error\": …}` on STDOUT with a non-zero exit.",
    "A usage error here (nothing on stdout, exit 2) means the flags moved — edit",
    "`packages/plugins/mail/src/himalaya/verbs.ts`, which is the one table the",
    "runner, the fake and this leg all read. A JSON body that arrived somewhere",
    "else means the envelope moved, and `run.ts`'s `refusedWith` must move with it.",
  ])
}

for (const verb of GMAIL_VERBS) {
  // No `-c` and no `--json`: clap answers `--help` before anything reads a
  // config or reaches Google, which is exactly the question — does this binary
  // HAVE these words. The argv order is the verb's own path, then the flag.
  const help = ask([...verb.path, "--help"])
  if (help.error !== undefined || help.status !== 0) {
    // clap's own sentence, when there is one: an unknown subcommand arrives on
    // stderr as `error: unrecognized subcommand '<word>'` before the usage block.
    const said = (help.stderr.split("\n")[0] ?? "").trim()
    const why = help.error !== undefined ? help.error.message : `exited ${help.status}${said === "" ? "" : ` — ${said}`}`
    fail([
      `check-himalaya-surface: the pinned \`himalaya\` does not answer \`himalaya ${verb.path.join(" ")}\``,
      `  verb: ${verb.id} — ${verb.says}`,
      `  why:  ${why}`,
      "",
      "Either the pin moved past the surface this plugin's `run.ts` and its fake",
      "were written against — then move both onto the verbs the pin now answers,",
      "and `packages/plugins/mail/src/himalaya/verbs.ts` is the one table to edit,",
      "because the runner, the fake and this leg all read it — or the pin's build",
      "came up without the `gmail` feature the version line above named.",
    ])
  }
}

// Draft writes publish structured identities alongside the read schemas.
// Other mutations and attachment saves still answer a JSON string.
const schemas = ["profile-get", "threads-list", "threads-get", "labels-list", "history-list", "drafts-create", "drafts-update"]
const temporary = mkdtempSync(join(tmpdir(), "olai-mail-surface-"))
try {
  const dumped = ask(["json-schema", "--dir", temporary])
  if (dumped.status !== 0) throw new Error(dumped.stderr || dumped.stdout)
  for (const name of schemas) {
    const file = `himalaya-gmail-${name}.json`
    const actual = JSON.parse(readFileSync(join(temporary, file), "utf8"))
    const expected = JSON.parse(readFileSync(new URL(`./schemas/${file}`, import.meta.url), "utf8"))
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${file} differs from the decoder's checked-in schema`)
  }
} catch (error) {
  fail([`check-himalaya-surface: schema check failed: ${String(error)}`])
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
