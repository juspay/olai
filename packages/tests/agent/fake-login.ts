#!/usr/bin/env bun
/**
 * THE COMMAND A `terminal` AUTH METHOD HANDS A CLIENT, as a real one behaves.
 *
 * The pinned Claude Code adapter does not run its own sign-in: it hands the
 * client a command line and expects the CLIENT to run it, print what it says
 * and type into it (`_meta["terminal-auth"]`, and `acp-agent.js`'s
 * `claude-ai-login`). So this is the other half of that contract, modelled from
 * what `claude auth login` actually does on a pipe (verified 2026-09-30):
 *
 *   - it prints the URL a person has to open, with no browser involved,
 *   - it prints a prompt and READS A LINE from stdin,
 *   - a code it does not accept prints `Invalid code` and asks again — the
 *     process stays up, which is the case a client that treated any output as
 *     the end would get wrong,
 *   - the code it accepts ends it with exit 0, and a credential appears on disk
 *     (here: {@link MARKER.signedIn}, which is what the scripted agent refuses
 *     to work without).
 *
 * Spawned as `bun <this file> …` by the scripted adapter, which is how the real
 * one points at itself (`process.execPath` + `process.argv.slice(1)`), so the
 * file needs no executable bit and no PATH.
 *
 * THE CODE is `OLAI_FAKE_LOGIN_CODE`, defaulting to {@link DEFAULT_CODE}, so a
 * scenario can make the first attempt wrong and the second one right without
 * this file knowing which it is being asked for.
 *
 * ... AND ONE CODE FAILS THE ATTEMPT ENTIRELY ({@link EXPIRED}): a one-time
 * code that has gone stale does not ask again, it ends, and the client is left
 * with a process that exited non-zero and output saying why — the OTHER way a
 * sign-in ends, and the one a panel that read any output as the end would get
 * wrong.
 */

import { appendFileSync } from "node:fs"
import { join } from "node:path"

import { MARKER } from "../support/scripted.ts"

/**
 * A SIGNAL IS THE CLIENT SAYING STOP, and this is where the claim that it worked
 * is recorded: a killed process leaves nothing else behind. Installed FIRST, so
 * a cancellation that lands before the login is even asked anything is still
 * said.
 *
 * `143` rather than `0`: a sign-in that was stopped did not succeed, and a
 * client that read the exit code as the outcome (it does not — a cancel is read
 * from its own flag) would be told the truth.
 */
process.on("SIGTERM", () => {
  appendFileSync(join(process.cwd(), MARKER.loginStopped), "")
  process.exit(143)
})

const DEFAULT_CODE = "123456"

/** A code that ends the attempt instead of asking again. */
const EXPIRED = "expired"

/** Where the sign-in leaves its credential — the directory the tool was
 *  started in, which is the served one: the scripted agent refuses to open a
 *  conversation without this file, and the panel's own reopen is what a
 *  scenario watches for. */
const credential = () => join(process.cwd(), MARKER.signedIn)

const said = (line: string): void => {
  process.stdout.write(`${line}\n`)
}

/**
 * A FULL-SCREEN LOGIN, which this fakes by refusing.
 *
 * The pinned adapter offers it only to a client that would host a terminal it
 * draws itself (`claude /login`), and on a remote session it offers NOTHING
 * else. Olai cannot draw one, and the point of the fake offering this shape at
 * all is that a scenario can assert it is NOT offered — so if it is ever run,
 * saying so beats pretending.
 */
const tui = (): never => {
  said("This login needs a full-screen terminal, which the panel does not have.")
  process.exit(9)
}

const login = async (): Promise<void> => {
  const wanted = process.env["OLAI_FAKE_LOGIN_CODE"] ?? DEFAULT_CODE
  said("Opening browser to sign in…")
  said("")
  said("https://claude.ai/fake-login?code=abc123")
  said("")
  const reader = Bun.stdin.stream().getReader()
  const decoder = new TextDecoder()
  let held = ""
  for (;;) {
    process.stdout.write("Paste code here if prompted > ")
    const read = await reader.read()
    if (read.done) {
      // A closed pipe is not a failure to report: whoever was typing has gone,
      // which for a real CLI is the end of the attempt.
      said("")
      process.exit(130)
    }
    held += decoder.decode(read.value, { stream: true })
    const at = held.indexOf("\n")
    if (at < 0) continue
    const typed = held.slice(0, at).trim()
    held = held.slice(at + 1)
    if (typed === EXPIRED) {
      said("This code has expired. Run the login again.")
      process.exit(1)
    }
    if (typed !== wanted) {
      said("Invalid code. Please try again.")
      continue
    }
    // THE CREDENTIAL, written before the exit that reports success — the order
    // a real login keeps, since a client that reopened the conversation on the
    // exit would otherwise race the file.
    appendFileSync(credential(), "")
    said("Logged in.")
    process.exit(0)
  }
}

const [mode] = process.argv.slice(2).filter((word) => word.startsWith("--") === false)
if (mode === "tui") tui()
else await login()
