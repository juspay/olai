/**
 * WHERE AN AGENT'S WORDS LAND — the one paragraph this row tells an agent
 * about itself, carried on its sibling entry beside the tools it brings and
 * read by `olai-plugin-mcp` into `initialize`'s `instructions`.
 *
 * ## The failure it answers
 *
 * Asked to link a person to a node, Claude Code put `/#happy-harmless-log` in
 * a code fence and hedged that it "did not have the served host or port". Both
 * halves are wrong, and nothing olai hands an agent said so: the tool
 * descriptions spell the data model — nodes, ids, mirrors, the search grammar
 * — and say nothing about WHO reads the answer and WHERE. That is not a fact
 * about any tool; it is a fact about this panel.
 *
 * ## Why this row says it, and not the MCP row
 *
 * Every sentence below is a rule this package owns and nothing else can vouch
 * for:
 *
 *   - **A person reads the answer in the chat panel, beside the outline** —
 *     `./browser/chat/Transcript.tsx` is that panel, mounted beside the panes.
 *   - **A backticked id in prose is pressable; one in a code fence does
 *     nothing** — `./browser/chat/refs.ts` (`askedOf`, `inFenceAt`): a span is
 *     a reference exactly when the set declares it and it is not inside a
 *     `<pre>`, because a fence is a quotation of code and an id inside one is
 *     a line somebody would paste. `docs/chat.md`, "Pointing back at a node",
 *     is the person's side of the same contract.
 *   - **A link to an app address is followed in place, beside the
 *     conversation; `https://` opens a new tab** — the transcript hands a
 *     press to the navigation row's `useFollow` and leaves an external link to
 *     the browser; the last paragraph of that same docs section promises it.
 *
 * It sat in `@olai/surface` for one PR, as a static string the MCP row
 * imported, and that was core speaking for a row: a serve may run `mcp` with
 * no `chat` row at all, and an external host dialling `/mcp` has no panel
 * anywhere — to either, "a person reads your answer in olai's chat panel" is a
 * sentence the agent's next glance disproves, after which the rest of the text
 * is decoration. Riding this row's `Sibling.charter` is what makes it true
 * exactly when it is said: the paragraph is on the wire while the panel is,
 * and gone when the panel is (`@olai/plugin-api`'s `services.ts` argues the
 * field; `@olai/server`'s `profiles.test.ts` reads both states).
 *
 * ## What it deliberately does not say
 *
 * Nothing about addresses — `/#<id>`, `/<path>`, what a tool's `at` is — those
 * are `@olai/format`'s grammar and true with no panel standing, so the MCP row
 * says them in its own paragraph. Nothing about `/today`, pins, marks or
 * search: each is another row's, and each is taught at the point of use by the
 * tool that owns it. ONE paragraph, in prose: it is a system prompt, and
 * Claude Code truncates server instructions at 2 KB — the whole composed text
 * stays under that, and every sentence here is spent on every turn.
 */
export const CHARTER =
  "A person reads your answer in olai's chat panel, beside the outline, so point at " +
  "things the way the panel can follow. A node id written in backticks in prose is " +
  "pressable there and shows that node; the same id inside a code fence is a quotation " +
  "and does nothing, so never fence an address you mean to be followed. A markdown link " +
  "to an app address — `[label](/#id)`, `[plan](notes/plan.md)` — is followed in place " +
  "beside the conversation, while an `https://` link opens a new tab."
