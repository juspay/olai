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
 *     whole of the answer and no output has to be parsed.
 *
 * There is no skip: a leg that passes when it could not find the binary is the
 * same silence again, one level up. Silence is also the SUCCESS output — the
 * recipe's stdout is CI output, and only failures are printed.
 *
 * ## Why a script and not a test file
 *
 * The binary's path is a build artifact somebody must ask nix for: no `himalaya`
 * belongs on a developer's PATH or in the dev shell, and `nix/himalaya.nix`
 * builds the pin from `npins/sources.json` (Cargo, fenix, pimalaya), which is
 * not something a `bun test` run should pay. So the asking belongs in the
 * recipe (`just mail-surface`) that hands this script the directory, and it
 * takes exactly ONE argument — a directory holding `himalaya` — so a developer
 * can point it at a candidate pin by hand before moving the pin.
 *
 * WHAT A FAILURE HERE MEANS is one of two things, and the sentence names which:
 * either the pin moved past what this plugin's `run.ts` and its fakes were
 * written against — the plugin needs updating, and the failure names the verb —
 * or the pinned build is broken or too old, which is a pin problem rather than
 * a plugin one. Both are things a conversation would otherwise draw first.
 */

import { spawnSync } from "node:child_process"

import { GMAIL_VERBS, HIMALAYA_VERSION_FLOOR } from "../packages/plugins/mail/src/himalaya/verbs.ts"

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
    "This is the binary `nix/himalaya.nix` builds and `default.nix` bakes as",
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

const [major, minor, patch] = found
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
