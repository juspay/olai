/**
 * WHERE AN AGENT'S WORDS LAND — the one paragraph olai tells an agent about
 * itself as an APPLICATION, rather than as a set of tools.
 *
 * ## The failure it answers
 *
 * Asked to link a person to a node, Claude Code put `/#happy-harmless-log` in
 * a code fence and hedged that it "did not have the served host or port". Both
 * halves are wrong, and nothing olai hands an agent said so. The agent has the
 * whole data model — nodes, ids, marks, mirrors, trash, the search grammar —
 * spread across thirty kilobytes of tool descriptions, and ZERO framing about
 * who reads its answer and where: that it is a chat panel beside the outline,
 * that a backticked id there is a button, that a fenced one is deliberately
 * inert, that an address is the app's own and needs no host. The tool prose
 * cannot carry this, because it is not about any tool.
 *
 * ## What it may claim, and what it deliberately does not
 *
 * ONLY WHAT IS TRUE WHATEVER ROWS ARE STANDING. A charter an agent can disprove
 * with its next tool call teaches that the rest of the text is decoration
 * (`olai-plugin-mcp`'s `endpoint.ts` argues it over `INSTRUCTIONS`, and this
 * rides in the same text). So every sentence here derives from a contract
 * that no plugin switch can turn off:
 *
 *   - **The address grammar** — `/#<id>` a node anywhere, `/<path>` a document
 *     or an outline, `/<path>.olai#<id>` that outline landed at the row,
 *     `/<path>.md#<slug>` a heading, `?q=` between the two halves — is
 *     `@olai/format`'s `address.ts` (the table at its head and `addressOf`),
 *     printed the way `olai-plugin-navigation`'s `routes.ts` writes a URL. That
 *     a tool's `at` is the same address without the leading `/` is the same
 *     grammar read off `search_nodes`' hits (`#a1b2c3`, `notes/plan.md`).
 *   - **App-relative, no host.** A route is followed inside the page the panel
 *     is mounted in (`routing.tsx`'s `useFollow`); `./edit.ts`'s `pin` carries
 *     the address verbatim for the same reason. Nothing between the agent and
 *     the person ever needs an origin.
 *   - **Pressability** — a backticked id in prose is a button and a fenced one
 *     is a quotation — is `olai-plugin-chat`'s `browser/chat/refs.ts`
 *     (`askedOf`, `inFenceAt`) and `docs/chat.md`, "Pointing back at a node".
 *   - **Link routing** — an app address in a markdown link is followed in
 *     place, `https://` opens a new tab — is `routing.tsx`'s `useFollow` and
 *     the last paragraph of that same docs section.
 *   - **Tool naming** — `<row>_<verb>`, and an absent row's verbs are absent —
 *     is `olai-plugin-mcp`'s `tools.ts` (`scopedToolName`) and the adapter's
 *     per-row ownership (juspay/kolu#2234).
 *
 * WHAT IT DOES NOT NAME: `/today`, `/d/<date>`, `/agenda`, `/trash`, pins,
 * mirrors, marks, dates, the search operators. Every one of those is a plugin's
 * — the journal's routes are off when the journal is, a pin is a row in a file
 * the outlines row mints — and every one is already taught, at the point of
 * use, by the tool that owns it (`outlines_index` carries the pin grammar,
 * `search_nodes` the operators). Repeating them here would spend the budget
 * below on sentences that are sometimes false.
 *
 * ## Why it lives here and not in the MCP row
 *
 * It is a static contract about olai — its addresses, its panel, its naming —
 * and not about MCP; the MCP row is merely the only wire that reaches an
 * agent's STANDING context (`olai-plugin-chat`'s `teaching.ts` argues that ACP
 * has no system prompt on either leg). Authoring it beside `./host.ts`, which
 * already says what each face of the app is, keeps the sentence where the
 * facts it states are owned; carrying it in `olai-plugin-mcp` alone would have
 * put the app's self-description in the one package that is about transport.
 * A static import across packages is what the composition allows for a
 * contract with no live value (AGENTS.md: "Static contracts may remain
 * imports").
 *
 * ## Size, and who drops it
 *
 * Claude Code truncates server instructions at 2 KB and bills them every turn,
 * so the WHOLE text it rides in — this plus the tool-surface paragraph before
 * it — stays under 2000 bytes; `olai-plugin-mcp`'s `endpoint.test.ts` holds
 * the boundary. Prose, not a list: it is a system prompt, and a bullet is a
 * thing an agent quotes back rather than obeys. Codex and Claude Code honour
 * `instructions`; opencode fetches it and drops it on the floor
 * (anomalyco/opencode#7373); pi is unverified. An agent on opencode is exactly
 * as untaught as it was before this file, and that is a known gap rather than
 * a bug here.
 */
export const AGENT_CHARTER =
  "A person reads your answer in olai's chat panel, beside the outline, so point at " +
  "things the way the panel can follow. An address is the app's own — there is no host " +
  "or port to know: `/#<id>` names a node wherever it lives, `/<path>` a document or an " +
  "outline, `/<path>.olai#<id>` that outline landed at the row, `/<path>.md#<slug>` a " +
  "heading, and `?q=<search>` before the fragment narrows the page. A tool's `at` " +
  "(`#a1b2c3`, `notes/plan.md`) is the same address without the leading `/`. A node id " +
  "written in backticks in prose is pressable and shows that node; the same id inside a " +
  "code fence is a quotation and does nothing, so never fence an address you mean to be " +
  "followed. A markdown link to an app address — `[label](/#id)`, `[plan](notes/plan.md)` " +
  "— is followed in place beside the conversation, while an `https://` link opens a new " +
  "tab. Tools are named `<row>_<verb>`; a row that is off has no verbs here, and a verb " +
  "you do not see is simply not available."
