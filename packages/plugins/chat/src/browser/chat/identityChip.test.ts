import { describe, expect, test } from "bun:test"

import type { AuthStatus } from "@kolu/acp/wire"

import { identityOf, identityTitleOf } from "./identityChip.ts"

const account = (fields: Partial<AuthStatus> & Pick<AuthStatus, "label">): AuthStatus => ({
  kind: "account",
  detail: null,
  account: null,
  ...fields,
})

describe("the agent line's account chip", () => {
  test("a subscription says its plan and the address that tells two apart", () => {
    expect(identityOf(account({
      label: "Claude Max",
      account: { email: "you@example.com", organization: "Olai", plan: "max" },
    }))).toBe("Claude Max · you@example.com")
    expect(identityOf(account({
      label: "ChatGPT Plus",
      account: { email: "work@example.com", organization: null, plan: "plus" },
    }))).toBe("ChatGPT Plus · work@example.com")
  })

  test("a key or a gateway falls back to the agent's own second line", () => {
    expect(identityOf(account({
      kind: "api_key",
      label: "Anthropic API key",
      detail: "apiKeyHelper",
    }))).toBe("Anthropic API key · apiKeyHelper")
    expect(identityOf(account({ kind: "gateway", label: "Custom model gateway", detail: "gateway.example" })))
      .toBe("Custom model gateway · gateway.example")
  })

  test("a label with nothing beside it is the whole line", () => {
    expect(identityOf(account({ kind: "external", label: "AWS Bedrock" }))).toBe("AWS Bedrock")
  })

  test("a known logged-out state is olai's words, not the agent's", () => {
    expect(identityOf({ kind: "none", label: "Not logged in", detail: null, account: null }))
      .toBe("Not signed in")
    expect(identityTitleOf({ kind: "none", label: "Not logged in", detail: null, account: null }))
      .toBe("Not signed in")
  })

  test("a kind this build has no word for still says what the agent said", () => {
    expect(identityOf(account({ kind: null, label: "Company SSO", detail: "sso.example" })))
      .toBe("Company SSO · sso.example")
  })

  test("the title carries what the line leaves out, once", () => {
    expect(identityTitleOf(account({
      label: "Claude Max",
      detail: "claude.ai",
      account: { email: "you@example.com", organization: "Olai", plan: "max" },
    }))).toBe("Claude Max · you@example.com · Olai · max · claude.ai")
    expect(identityTitleOf(account({
      label: "Claude Max",
      detail: "you@example.com",
      account: { email: "you@example.com", organization: null, plan: null },
    }))).toBe("Claude Max · you@example.com")
  })
})
