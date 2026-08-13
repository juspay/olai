# The orchestrator: from a terminal session to a thing that exists

Status: brainstorming, opened 2026-08-13 by the human, provoked by a real
failure (the Fable burn: agents launched all day on the wrong model because
the agent's spelling lived nowhere). Nothing here is ratified.

## What the orchestrator is today

A Claude Code session sitting in `~/code/olai`, following a charter that
lives in a gist, holding everything else in its head: which lanes run where,
which terminal is whose, what was approved, which CI hosts are sick, what
"the Opus author" even means. It operates across repos (olai, kolu, drishti)
— cutting worktrees, chartering authors and reviewers over kolu terminals,
running merge gates, stamping the ledger.

The failure mode is now proven, twice over: session memory dies at
compaction, and knowledge that lives nowhere (the agent's argv) silently
defaults. Everything the orchestrator knows that is not in a file is a burn
waiting to happen.

## The question: where should the orchestrator live?

### Shape A — its own repo

`~/code/orchestrator`, a git repo served by olai, holding outlines:

- `agents` — one node per agent: title `opus`, note carrying the exact argv
  (fenced block = the command), children carrying the why. Launchers read the
  node (`read_node agent-opus`), never compose a command. A missing name
  refuses loudly.
- `lanes` — dispatch state as nodes: what runs where, terminal ids, briefs,
  approvals, evidence pointers. Compaction-proof operational memory.
- the charter — the gist retires into a versioned file/outline.
- operational knowledge — the sick-host dossier, pin SHAs, CI conventions.

The orchestrator session runs *there*, operating on target repos, whose
roadmaps stay their own.

### Shape B — orchestration is a built-in olai feature (the human's lean)

The stronger observation: olai already has the pieces, and a standing roadmap
subtree asking for this ("Orchestrate from the chat, not a terminal", the
oic-* children). If orchestration is olai-native:

- **Agents are nodes** in a served outline (`agents.jsonl` or `.olai` —
  below). The same definition the human edits in the outliner is the one
  olai's own launch verb reads. No second store, no config file, no
  `.claude/` collision — files are the database, and this is the database.
- **Launching is an op**: olai calls kolu's `lifecycle_create` (which is
  learning `--worktree` in kolu PR #2167 *right now*) with the argv from the
  agent node. Kolu stays pure mechanism; its philosophy is untouched.
- **Lanes are nodes**: a dispatch creates a node (or lives on the roadmap
  item itself) carrying terminal id, brief, state. The pipeline's events —
  review verdicts, delta reports, CI results, approvals — land as children.
  The ledger discipline stops being the orchestrator's manual habit and
  becomes the shape of the feature.
- **Approvals are in-app**: "I approve X" becomes a verb on the node, not a
  chat message an LLM must remember across compaction.
- **The LLM orchestrator becomes optional labor**, not the system of record:
  a chat agent (or a human) drives verbs; the state is always in the
  outline. Today's terminal orchestrator is the transitional form.

Shape B subsumes Shape A: whether the orchestration outlines live in the
operated repo or a dedicated one becomes a per-setup choice, not an
architecture.

## The agent-launch aspect (the part the burn demands, in either shape)

1. One node per agent; the note carries the exact argv; children carry
   rationale and history.
2. Every launcher — the terminal orchestrator today, olai's launch verb
   tomorrow — reads the node and refuses on absence. Nobody ever composes a
   model flag.
3. Provenance: a dispatched lane records *which agent node* launched it (a
   see-edge or mirror). The Fable burn becomes the failure this graph makes
   impossible to miss: lanes citing no agent node are the smell.
4. Verification stays: the launcher confirms the booted agent's identity
   (e.g. Claude's `/status`) before chartering. A definition can be wrong;
   the boot check catches it loudly.
5. Rejected alternatives, for the record: hand-written `.claude/settings.json`
   (apm-generated surface — reverted 2026-08-13); `.claude/settings.local.json`
   (worked, machine-local, but a second store outside olai — removed at the
   human's word); a kolu-side agents config (violates kolu's zero-config
   philosophy); apm runtime settings (upstream feature that does not exist
   yet — see apm-adoption; complementary, not competing).

## Is it time for `.olai` over `.jsonl`?

The human's question, raised now because new outlines (agents, lanes) are
about to be born — the cheapest moment to decide.

For `.olai`:
- The format is not "some JSON lines"; it is olai's dialect (ids, marks,
  edges, one node per line). A name says so.
- New kinds of outlines living in non-olai contexts (an orchestrator repo, a
  target repo's `agents` file) read clearly as olai's.
- File association, tooling, syntax highlighting get an anchor.

Against / costs:
- Migration touches everything that says `.jsonl` (code, tests, docs,
  daily-notes and Archive conventions, the website).
- Generic tooling (`jq`-style workflows) loses the extension hint, though the
  content stays JSONL.

The obvious path if ratified: olai serves both extensions, `.olai` preferred;
new outlines are born `.olai`; existing files migrate as an unhurried chore.

## Open questions for ratification

1. Shape B as the direction, with today's terminal orchestrator as the
   transitional operator? (Shape A remains available as "where the outlines
   live" even under B.)
2. Which comes first: the `agents` outline + launch verb (small, kills the
   burn class), or lane-state-as-nodes (bigger, kills the compaction class)?
3. Does the launch verb wait on kolu #2167 (`lifecycle_create --worktree`)
   landing, or ship reading agents nodes with the orchestrator still doing
   the kolu calls?
4. `.olai`: ratify dual-extension-prefer-new, or defer entirely?
5. Where do cross-repo lane events get stamped once lanes are nodes — the
   operated repo's roadmap (today's habit), the orchestration outline, or
   both via mirrors?
