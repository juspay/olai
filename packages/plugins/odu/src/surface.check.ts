import { Effect } from "effect"

import { ODU_COMMAND, probing } from "./probe.ts"

const dir = process.argv[2]
if (dir === undefined || dir === "") {
  console.error("usage: check-odu-surface.ts <dir holding the pinned `odu`>")
  process.exit(2)
}

const found = await Effect.runPromise(Effect.scoped(probing(dir)))

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

console.error(`check-odu-surface: the pinned \`${ODU_COMMAND}\` answers with every verb a conversation is promised`)
console.error(`  ${found.server.command} ${found.server.args.join(" ")}`)
