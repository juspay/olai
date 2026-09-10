/**
 * DOES THE PINNED `odu` STILL ANSWER THE PROBE — asked of the binary the build
 * actually bakes, not of a script this repo wrote.
 *
 * ## Why this exists as its own leg
 *
 * `packages/plugins/odu/src/probe.test.ts` pins the JUDGEMENT: what a missing
 * verb draws, what an unaimed one draws, how a wedged server is told from a
 * hung-up one. Every `odu` in it is a fixture that file wrote, which is the
 * only way to state those cases — and it is also the reason that suite cannot
 * see a pin move underneath it. It did not: the bump to juspay/odu#105, which
 * renamed every verb the probe asks for, left all of it green while a packaged
 * olai drew "its tool surface is missing `run`" in every conversation.
 *
 * So this leg asks the one question the fixtures structurally cannot. It runs
 * the REAL probe — `probing` itself, imported, not a re-spelling of it — with a
 * PATH holding exactly the `odu` that `nix/odu.nix` builds from
 * `npins/sources.json`, and demands the arm that hands a session a server.
 * There is no skip: a leg that passes when it could not find the binary is the
 * same silence again, one level up.
 *
 * ## Why a script and not a test file
 *
 * `bun test` runs in the dev shell, and the dev shell deliberately carries no
 * `odu` — `nix/odu.nix`'s `bin` is lazy there because building it needs a
 * bun2nix the shell has none of. The binary's path is therefore a build
 * artifact somebody must ask nix for, and the asking belongs in the recipe
 * (`just odu-surface`) that hands this script the directory. One argument, so
 * that a developer can also point it at a candidate odu by hand before moving
 * a pin.
 *
 * WHAT A FAILURE HERE MEANS is one of two things, and the sentence the probe
 * itself composed is the one printed: either the pin moved past what this
 * olai's `probe.ts` was written against — the plugin needs updating, and the
 * probe just named which verbs — or the pinned build is broken in a way that
 * would have reached a conversation.
 */

import { Effect } from "effect"

import { ODU_COMMAND, probing } from "../packages/plugins/odu/src/probe.ts"

const dir = process.argv[2]
if (dir === undefined || dir === "") {
  console.error("usage: check-odu-surface.ts <dir holding the pinned `odu`>")
  process.exit(2)
}

// THE PATH IS EXACTLY THIS ONE DIRECTORY, never the caller's own: the leg is a
// claim about the pinned binary, and a developer's `~/.nix-profile/bin/odu`
// answering it instead would be the probe's own founding complaint (a machine
// deciding a question the build is supposed to).
const found = await Effect.runPromise(Effect.scoped(probing({ PATH: dir })))

if (found.missing !== null) {
  console.error(`check-odu-surface: the pinned \`${ODU_COMMAND}\` does not answer this olai's probe`)
  console.error(`  where: ${found.missing.where ?? "(nothing was resolved on the PATH given)"}`)
  console.error(`  why:   ${found.missing.why}`)
  console.error("")
  console.error("This is what a conversation would draw instead of CI tools. Either move")
  console.error("`packages/plugins/odu/src/probe.ts` onto the surface the pin now answers")
  console.error("with, or move the pin back — see nix/odu.nix.")
  process.exit(1)
}

if (found.server === null) {
  // Unreachable through `probing`'s own arms — both halves are set together.
  // Stated anyway: a probe that ever answered with neither would otherwise
  // pass this leg silently, and silence is the failure this file exists for.
  console.error("check-odu-surface: the probe reported no server and no reason, which is neither arm")
  process.exit(1)
}

console.error(`check-odu-surface: the pinned \`${ODU_COMMAND}\` answers with every verb a conversation is promised`)
console.error(`  ${found.server.command} ${found.server.args.join(" ")}`)
