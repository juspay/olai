/**
 * WHAT CHAT TEACHES THE VAULT'S VOCABULARY — one word, and what a value of it
 * has to be.
 *
 * An `agent-session` value is what makes a node a NODE AGENT: it names the
 * ENGINE that node's agent runs on and, after a colon, WHICH conversation it is
 * having. `claude` is a node agent with no session yet; `claude:0f3c8d21-…` is
 * one that is bound. The presence of a value is the binding, the subtree is
 * that agent's memory, and every reading of both is `./server/agents.ts`'s.
 *
 * ## Why this is a KIND now, and it was a bare key
 *
 * It was `AGENT_PROP` — the string `"agent-session"` — spelled once in
 * `@olai/format` and read by four packages, because when chat was core there was
 * nobody else it could belong to. A key's SPELLING is not a licence, and this
 * key carries the sharpest one in the tree: a value here decides which node a
 * session is fenced to, which subtree it may write in, and which ancestor a
 * refusal names. A vault that happens to call a column `agent-session` and means
 * something else by it was, until this lane, a vault whose columns olai read as
 * bindings.
 *
 * ## TWO LAYERS, AND THE VAULT IS THE OUTER ONE
 *
 * The composition is `@olai/plugin-api`'s `kindWordOf` — this plugin's own name,
 * then the bare word — so what a declaration writes is {@link SESSION_TYPE},
 * `chat-agent-session`. A vault that has said nothing about that key gets the
 * claim; a vault that declares it something else has said what it means, and
 * nothing here ever writes anybody's vault.
 *
 * THE BARE WORD CARRIES A HYPHEN OF ITS OWN, which is the one thing about this
 * kind that is not like the tenants': `kindWordOf` splits at the FIRST hyphen,
 * so `chat-agent-session` decomposes to `chat` and `agent-session` and the
 * composition stays injective. `@olai/plugin-api`'s `contract.ts` argues that
 * where the rule is, and its `kinds.test.ts` holds this file's second spelling
 * equal to the registry's.
 *
 * ## AND WHAT AN EXISTING VAULT OWES: ONE ROW
 *
 * A vault written before this lane carries the bare key `agent-session`, which
 * nothing claims any more. One row in `_olai/Properties.olai` keeps it:
 *
 *     {"title":"agent-session","custom":{"type":"chat-agent-session"}}
 *
 * olai never writes that row for anybody — a tool that edited somebody's
 * declarations file to keep its own feature working would be the vault's
 * judgement being overruled by a release. What olai does instead is SAY SO: the
 * store's validator names the row when it meets a bare `agent-session` value
 * with no declaration behind it ({@link kinds}' `wasCalled`, spent by
 * `@olai/format`'s `reportLegacyKeys`), and `docs/plugins/chat.md` and
 * `docs/running.md` carry it in words.
 *
 * THIS REPOSITORY HAS NO BOARD OF ITS OWN — the orchestrator's vault lives
 * elsewhere — so what gained the row in this lane is the two vaults the repo
 * DOES carry, and they are fixtures: `.saatchi/fixtures/_olai/Properties.olai`,
 * whose lanes are photographed, and `packages/tests/fixtures/lanes/`, which the
 * suite serves. Both keep records under the bare key on purpose, which makes
 * them the migration's own standing rehearsal rather than a pair of files that
 * happened to need editing.
 *
 * ## The shape is the FORMAT'S reading, read backwards
 *
 * `sessionIn` is total over any string and answers `null` for a value that
 * names no engine — an empty value, or one whose engine half is empty
 * (`:sess-1`). That IS the admission rule, so it is spent here rather than
 * spelled a second time: a value this kind admitted and that reading rejected
 * would be two answers about one string.
 */

import { sessionIn } from "@olai/format"

/** THE TWO WORDS, from the door that publishes them. They are `./binding.ts`'s
 *  and not this module's because ANOTHER PLUGIN reads them — a Spaces mirror
 *  has to know which column a node agent's binding is in — and that module
 *  imports nothing at all, so naming the word costs a consumer one file rather
 *  than this one's graph. Re-exported here because everything on THIS side of
 *  the wall reaches for the vocabulary, not the door. */
export { SESSION_KIND, SESSION_TYPE } from "./binding.ts"
import { SESSION_KIND, SESSION_TYPE } from "./binding.ts"

/**
 * The contribution, as `@olai/plugin-api`'s registry reads it — spent by the
 * validator, by the write planner, and by the fold that decides what a key is
 * declared as.
 *
 * `claims` IS NOT SPELT HERE and cannot be: `kinds.register` sets it equal to
 * the word it just composed out of the registering fiber's own name
 * (`@olai/plugin-api`'s `services.ts`), which is what makes a built-in
 * declaration safe — enabling chat can only ever declare `chat-agent-session`,
 * so a column somebody else calls `agent-session` is untouchable by a flag on
 * the machine.
 *
 * `wasCalled` IS THE OTHER HALF OF THAT SAME SENTENCE, and it is the one field
 * on this row the migration needs. It is the key this kind used to be spelled as
 * while chat was core, and it is emphatically NOT a second claim: a bare
 * `agent-session` is a word any vault might be using for something of its own,
 * so olai declares it for nobody and SAYS SO instead — `@olai/format`'s
 * `reportLegacyKeys` meets a value under that key that no declaration judges,
 * and names the one row in `_olai/Properties.olai` that ends it, quoting the
 * composed word off this very table. The finding sits on the declarations file
 * rather than on every record, so a vault mid-migration is not darkened row by
 * row, and it stops the moment the vault has spoken — including by declaring the
 * key `text`, which is a board saying the column is prose.
 */
export const kinds = [{
  kind: SESSION_KIND,
  takes: `\`${SESSION_TYPE}\` (an engine, optionally \`:\` and a session id)`,
  admits: (value: string) => sessionIn(value) !== null,
  wasCalled: SESSION_KIND,
}] as const

/**
 * THIS PLUGIN'S OWN VOCABULARY, as `@olai/format` takes one — for the readings
 * in this package, which ask the vault's declarations and must see the claim
 * above folded in exactly as every other reader does.
 *
 * It is `olai-plugin-kolu`'s `ownKinds` and `olai-plugin-odu`'s, word for word,
 * and for their reason: BOTH HALVES ARE THE SAME TABLE, which is honest rather
 * than a shortcut — a reading in this package runs only on a serve that composed
 * this plugin, so its own kind is enabled by construction. What it must NOT do
 * is spell the precedence itself; it hands this to the shared fold
 * (`@olai/format`'s `withClaims`) and gets back one map, like every consumer in
 * the tree, so a vault's own row wins here exactly as it does everywhere else.
 *
 * THE MAP IS KEYED BY THE COMPOSED WORD and each row carries it as its `kind`
 * and its `claims`, which is what the registry does off the registering fiber.
 * `wasCalled` rides along unchanged, so the reading a bench drives and the
 * reading a serve drives are owed the same migration sentence.
 */
const OWN = new Map(
  kinds.map((one) => [SESSION_TYPE, { ...one, kind: SESSION_TYPE, claims: SESSION_TYPE }]),
)
export const ownKinds = { built: OWN, enabled: OWN }
