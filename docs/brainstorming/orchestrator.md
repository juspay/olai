# The orchestrator: give it a real home

Status: brainstorming, opened 2026-08-13 by the human. Nothing here is decided.

## The problem, in one story

Today "the orchestrator" is a Claude session in a terminal. It follows a
charter that lives in a gist, and it keeps everything else in its head: which
agents are running where, what was approved, and even what "the Opus agent"
means as a command. Twice today that head failed us: its memory gets wiped
when the session compacts, and this morning every agent it launched ran on
the wrong model — because the right command was written down nowhere, so a
machine default won.[^burn]

Lesson: anything the orchestrator knows that is not in a file is a failure
waiting to happen.

## Question 1 — where should the orchestrator live?

**Option A: its own repo.** A repo (say `~/code/orchestrator`) holding
outlines: the agent definitions, the state of every running lane, the
charter, the operational notes.[^own-repo] The orchestrator session runs
there and works on the other repos.

**Option B: inside olai itself (the human's lean).** Olai already wants this
— the roadmap has long had "orchestrate from the chat, not a terminal".
If orchestration is an olai feature:

- Agent definitions are **nodes** in an outline. The same thing you edit in
  the app is the thing every launcher reads.
- Starting a lane is an olai **operation**: olai asks kolu to make a terminal
  in a fresh worktree and run the agent's command.[^kolu-verb]
- Running lanes are **nodes too**: who's working, in which terminal, what
  was reviewed, what was approved. The orchestrator's memory becomes the
  outline — it survives anything.
- Approving becomes a button on the node, not a chat message an LLM has to
  remember.
- The terminal orchestrator (me) becomes temporary labor, not the system of
  record.

Option B contains option A: where the outlines live becomes a small choice,
not the architecture.

## Question 2 — who knows how to start an agent?

The heart of the wrong-model bug. Three candidate answers, none ratified:

**Option 1: the command lives in a node.** An `agents` outline; the node
titled `opus` carries the full command in its note. Launchers read the node
and run exactly that. A missing node refuses loudly — nobody can fall back
to a default.[^node-argv]

**Option 2: kolu accepts a structured spec.** Instead of a raw command, the
launcher passes kolu something like `{"type": "claude", "model": "opus",
"perms": "bypass"}`, and kolu itself turns that into the right command line.
The agent node then stores this small spec instead of a command string.
What it buys: the flag spellings live in one place (kolu — the product whose
job is agent terminals), and the spec has checkable fields instead of being
a typo-prone string. What it costs: when an agent CLI renames a flag, the
fix needs a kolu release instead of a node edit. The philosophy check passes
with guardrails.[^spec]

**Option 3: apm becomes the launcher.** apm — the agent package manager —
already has a "run agents" layer for some runtimes, just not for Claude Code
or Grok today.[^apm] If it grows those, launching could be apm's job, with
the definitions in `apm.yml`. A watch item, not a plan.

**Option 4: `apm run` scripts — SPIKED, and it failed the test that
matters.** `apm.yml` can hold npm-style scripts whose body is any command
(the docs' own examples invoke claude), so launching works today — the spike
booted the claude TUI through it with the right model and permissions. But
**the wrapper blinds kolu**: with `apm run` on the terminal's argv, kolu sees
a python process — the agent column goes empty, and `kolu wait` / `kolu
debrief` (the tools the orchestrator babysits every lane with) time out.
Measured, not guessed.[^spike] The spike's ranking: keep `kolu create --
claude …` for launching; use apm at most as a prompt compiler off the spawn
path. Full report: `apm-spike.md` in this directory.

These compose rather than exclude: option 1 can ship now; option 2 is a kolu
feature the node's content would migrate into; option 3 is an ecosystem bet;
option 4 is measured out of the launch path (its prompt-compilation half
remains interesting for the charter layer).

Rejected along the way, for the record.[^rejected]

## Question 3 — is it time for `.olai` instead of `.jsonl`?

New outlines (agents, lanes) are about to be born — the cheapest moment to
rename. The objections both collapsed under the human's push-back: migration
is one small PR because there is exactly one user, and the "generic tooling"
argument was defending `jq`-style pipelines that the design *discourages*
anyway — structured access has one door (the MCP), and the break-glass cases
(`cat`, `grep`, `git diff`) don't care what a file is called.[^olai-ext]

If ratified: one atomic rename PR, new outlines born `.olai`, no transition
period.

## Open questions

1. Ratify option B (orchestration in olai) as the direction?
2. Pick from question 2 — or ship option 1 now and leave 2/3 open?
3. Should the agents outline exist immediately (kills the wrong-model bug
   with one small commit), with the launch button coming later?[^halves]
4. `.olai`: ratify the atomic rename?
5. When lanes become nodes, where do cross-repo events get stamped — the
   worked-on repo's roadmap (today's habit), the orchestration outline, or
   both via mirrors?

---

[^burn]: 2026-08-13: all five dispatched authors ran on Fable instead of
    Opus. The spawn command was bare `claude`; the machine default decided.
    Fixed for the moment by explicit `--model opus
    --dangerously-skip-permissions` flags at every spawn plus a `/status`
    check before chartering. The orchestrator's charter gist:
    gist.github.com/srid/af6b4bcccf649fb923e4e207a7b93c51.

[^own-repo]: Contents sketch: `agents` (definitions), `lanes` (dispatch
    state: terminal ids, briefs, approvals, evidence pointers), the charter
    (the gist retires into a versioned file), operational knowledge (the
    sick CI-host dossier, pin SHAs). Target repos keep their own roadmaps.

[^kolu-verb]: Via kolu's `lifecycle_create` MCP tool, which is learning to
    cut worktrees right now (kolu PR #2167, in flight from our own lane).
    Kolu stays pure mechanism — it runs whatever command it is handed and
    configures nothing, per kolu.dev/philosophy.

[^node-argv]: The orchestrator becomes the first consumer: `read_node
    agent-opus` before every spawn, run exactly what the note says. Zero new
    olai code. Provenance comes free: a lane can carry an edge to the agent
    node that launched it, so "which agent ran this?" is answerable — the
    question the Fable burn couldn't answer.

[^spec]: Philosophy check against kolu.dev/philosophy: (a) zero-setup
    survives — kolu reads no file, stores nothing; the spec arrives in each
    call; (b) agent-agnostic survives read as "no lock-in" — kolu already
    has per-agent knowledge in its shell detection; composing flags is
    detection's generative twin. Guardrails: unknown type/field/value
    refuses in words (no default model exists anywhere in the path); raw
    argv remains as the universal escape hatch; same spec always produces
    the same argv, printable back for logging.

[^apm]: microsoft/apm. Its runtime layer supports Copilot CLI, Codex,
    Gemini CLI, and the LLM library — not Claude Code or Grok (Grok has
    experimental *target* support, PR #2420, which is config deployment,
    not launching). Related: apm deploys `.claude/` configuration (hooks,
    MCP) into `settings.json`, and declined to own runtime permission
    decisions (issue #1157's L2/L3 doctrine) — any settings-value
    passthrough request must be framed as config lifecycle (L3), which they
    claim. See apm-adoption on the roadmap.

[^rejected]: Hand-written `.claude/settings.json` — worked (proven: repo
    file beats machine default, `bypassPermissions` boots on), but that file
    is apm-generated output and the commit was unauthorized; reverted.
    `.claude/settings.local.json` — also worked, machine-local, uncommitted
    by design (worktrees inherit it, even from kolu's bare root), but it is
    a second store outside olai; removed at the human's word. A kolu config
    file (`.kolu/agents.toml`) — violates kolu's zero-config principle;
    never built.

[^olai-ext]: The format stays plain line-oriented JSON either way. The
    one-situater doctrine (every reading through the MCP, never a second
    parser) is why encouraging raw `jq` pipelines works against the
    product's grain.

[^spike]: Grok spike, 2026-08-13, against apm 0.28.0 from source. Key
    measurements: `kolu ls` for an `apm run`-wrapped claude shows
    `FOREGROUND python`, agent JSON `null` the whole session (vs
    `kind=claude-code, model=claude-opus-5` for the direct control);
    `kolu wait --until awaiting,waiting` met in 8ms direct, timed out
    wrapped. Also found: Claude/Grok are apm *targets* (config deployment),
    not launch runtimes; `apm runtime setup codex` destructively rewrites
    `~/.codex/config.toml`; registered-runtime scripts get their prompt
    passed as an argument with Codex forced onto `codex exec`. Details:
    `apm-spike.md`.

[^halves]: "Ship in halves": the outline is the fix (the knowledge exists,
    launchers read it), the launch verb is the convenience (olai calling
    kolu itself). The verb waits on kolu #2167 landing and on the
    orchestrate-from-chat design deciding where launching lives in the UI.
