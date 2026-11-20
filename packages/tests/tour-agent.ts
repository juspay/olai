#!/usr/bin/env bun
import { spawn } from "node:child_process"
import { join } from "node:path"
import { createInterface } from "node:readline"

type Exchange = { said: string; line: string; reply: string; replyAs: string }

export const EXCHANGES: ReadonlyArray<Exchange> = [
  {
    said: "I put the paint samples on the north wall. Mark it done.",
    line: "done paint",
    reply: "marked `paint` done.",
    replyAs: "Done. I marked Paint samples on the north wall done.",
  },
  {
    said: "I paid the deposit. Mark it done.",
    line: "done deposit",
    reply: "marked `deposit` done.",
    replyAs: "Done. I marked Pay the deposit done.",
  },
  {
    said: "The tiler came on Friday. Mark it done.",
    line: "done tiler",
    reply: "marked `tiler` done.",
    replyAs: "Done. I marked Meet the tiler on site done.",
  },
  {
    said: "The plumber is booked. Mark it done.",
    line: "done plumber",
    reply: "marked `plumber` done.",
    replyAs: "Done. I marked Book the plumber done.",
  },
]

const SCRIPTED_NAMES = ["Fake One", "Claude Max"]

type Pair = readonly [string, string]

const inJson = ([from, to]: Pair): Pair => [JSON.stringify(from).slice(1, -1), JSON.stringify(to).slice(1, -1)]

const swap = (line: string, pairs: ReadonlyArray<Pair>): string =>
  pairs.reduce((out, [from, to]) => out.split(from).join(to), line)

const TO_AGENT = EXCHANGES.map((e) => inJson([e.said, e.line]))
const FROM_AGENT = [
  ...EXCHANGES.map((e) => inJson([e.reply, e.replyAs])),
  ...SCRIPTED_NAMES.map((name) => inJson([name, "Scripted demo"])),
]

const withoutLocations = (line: string): string =>
  line.includes('"locations"')
    ? JSON.stringify(JSON.parse(line, (key, value: unknown) => (key === "locations" ? undefined : value)))
    : line

if (import.meta.main) {
  const scripted = join(import.meta.dir, "..", "plugins", "claude", "e2e", "fake", "claude-agent-acp")
  const child = spawn(scripted, process.argv.slice(2), { stdio: ["pipe", "pipe", "inherit"] })
  createInterface({ input: process.stdin })
    .on("line", (line) => child.stdin.write(swap(line, TO_AGENT) + "\n"))
    .on("close", () => child.stdin.end())
  createInterface({ input: child.stdout }).on("line", (line) => {
    process.stdout.write(withoutLocations(swap(line, FROM_AGENT)) + "\n")
  })
  child.on("exit", (code) => process.exit(code ?? 0))
}
