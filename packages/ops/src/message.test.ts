/**
 * How a commit is SIGNED — which is what is left here now that composing the
 * words moved to `@olai/format` (the message is a function of a selection, and
 * the selection is made in a browser).
 *
 * The trailer is the only permanent record of WHO: git writes the repository's
 * own name and email whoever asked, so without it an agent's commits are
 * indistinguishable from a person's, and an audit trail of what the TOOL wrote
 * stops being one.
 */

import { expect, test } from "bun:test"

import { AUDIT, signed } from "./message.ts"

test("a signed message carries the prefix and the writer trailer", () => {
  expect(signed("reconcile the roadmap", "chat-agent")).toBe(
    "olai: reconcile the roadmap\n\nX-Olai-Writer: chat-agent\n",
  )
})

test("what is already prefixed is not prefixed twice", () => {
  expect(signed("olai: 3 edits to roadmap — x done", "web")).toStartWith(
    "olai: 3 edits to roadmap — x done\n\n",
  )
})

test("an empty message is still a message", () => {
  expect(signed("   ", "mcp")).toStartWith("olai: commit\n")
})

/** The audit convention handed down to `@olai/git`, and the one it is asked
 *  with, are the same two strings the composer and the signer put on. A second
 *  spelling of either would leave `last` reading back nothing it wrote. */
test("the audit filter is the prefix and the trailer this file writes", () => {
  const message = signed("anything", "web")
  expect(message).toStartWith(`${AUDIT.prefix}:`)
  expect(message).toContain(`${AUDIT.trailer}: web`)
})
