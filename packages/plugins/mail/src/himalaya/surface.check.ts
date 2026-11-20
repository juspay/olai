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

const binary = `${dir}/himalaya`

const ask = (args: ReadonlyArray<string>) => spawnSync(binary, args, { encoding: "utf8" })

const fail = (lines: ReadonlyArray<string>): never => {
  for (const line of lines) console.error(line)
  process.exit(1)
}

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
  const help = ask([...verb.path, "--help"])
  if (help.error !== undefined || help.status !== 0) {
    // clap puts an unknown subcommand on stderr as `error: unrecognized
    // subcommand '<word>'`, ahead of the usage block.
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
