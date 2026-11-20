#!/usr/bin/env bun
/**
 * What `claude auth login` does on a pipe (verified 2026-09-30): it prints the
 * URL with no browser involved, prompts and READS A LINE from stdin, prints
 * `Invalid code` and asks again on a code it does not accept — the process
 * stays up — and exits 0 on the one it takes, leaving a credential on disk.
 */

import { appendFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { MARKER_FILE } from "../support/scripted.ts"

appendFileSync(join(process.cwd(), MARKER_FILE.loginPid), `${process.pid}\n`)

const DEFAULT_CODE = "123456"

const EXPIRED = "expired"

const credential = () => join(process.cwd(), MARKER_FILE.signedIn)

const said = (line: string): void => {
  process.stdout.write(`${line}\n`)
}

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
    appendFileSync(credential(), "")
    writeFileSync(
      join(process.cwd(), MARKER_FILE.identity),
      JSON.stringify({
        kind: "account",
        label: "Claude Max",
        account: { email: "signed-in@example.com", organization: "Olai", plan: "max" },
      }),
    )
    said("Logged in.")
    process.exit(0)
  }
}

const [mode] = process.argv.slice(2).filter((word) => word.startsWith("--") === false)
if (mode === "tui") tui()
else await login()
