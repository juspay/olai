# brain: the orchestrator's vault

Status: brainstorming, 2026-08-24. One vault per orchestrator — not per project, not per person. Every repo the orchestrator works on shares it: **one repo, one set — with a folder per project so nothing is jumbled.** One olai server, zero olai changes. Future: the same orchestrator serves multiple users.

## The layout — today's vault, moved

```
~/brain/                      ← one git repo, one olai server, public
├── Inbox.olai
├── Pins.olai
├── days/2026-08-24.olai
├── orchestrator/
│   ├── dag.olai
│   ├── lanes.olai            ← lanes for ALL repos, as already designed (repo is a prop)
│   └── agents.olai
├── olai/
│   ├── roadmap/features.olai
│   ├── brainstorming/orchestrator.md
│   └── RCA/
├── kolu/
│   ├── roadmap/features.olai
│   └── brainstorming/pi-lanes.md
└── odu/                      ← a repo you don't even own; your notes on it
    └── roadmap/quirks.olai
```

Per-repo **folders**, one **vault**: the shared things (GTD, the board) sit at the root; each project keeps its own roadmap, brainstorms and RCAs in its folder, not jumbled together. It is still ONE set, so a cross-repo dependency is an ordinary `after` edge, refused by `set_doing` like any other:

```
olai/roadmap/features.olai:  {"id":"surface-cli-olai","after":["kolu-surface-cli"], ...}
kolu/roadmap/features.olai:  {"id":"kolu-surface-cli", ...}
```

`under:kolu is:todo` narrows to one project; `is:todo has:date` is every project, one agenda.

What stays in each code repo: only the docs that change in the same PR as the code (`architecture.md`, `format.md`, README). Each repo's CLAUDE.md points at the brain for everything else:

```
~/code/kolu/CLAUDE.md:  Development docs — brainstorms, RCAs, roadmap — live in the brain:
                        https://github.com/srid/brain · file roadmap items via the olai MCP.
```

The seam has a known cost: the engineering docs and the brainstorm archive cite each other (~26 links, verified: 20 in, 6 out), and those become cross-repo URLs at migration.

## A lane still points at code

```
lanes.olai:  {"id":"lane-kolu-surface-cli","props":{"repo":"~/code/kolu","item":"kolu-surface-cli","agent":"claude","merge":"auto"}}
```

Terminal and worktree live in `~/code/kolu`; the board, the roadmap node it closes, and the night-log live in the brain. The driver reads and writes one vault — its own. The only remote thing in the orchestrator is padi.

## The commit logs

```
~/code/olai   master:  "Sends queue by default, steering becomes the explicit gesture (#372)"
~/brain       master:  "olai: #372 lands (fa5d250e) — lane-queue closes; roadmap node done"
```

Code history is code. Ledger history is ledger. The spam was never the problem — it was in the wrong room.

## Ids

One set, ids unique everywhere — the validator's duplicate-id rule refuses a clash, so conflicts are a naming annoyance, never corruption. Chosen ids carry the project as a prefix (`kolu-surface-cli`, `odu-flaky-ci`), the `dag-pr-*`/`lane-*` pattern; olai's existing ids are grandfathered (renaming breaks `see`/`after`). Ids nobody will type are omitted and minted.

## Planning lands in one place

A planning session — wherever it runs — writes the thinking AND the filings into the brain, over the same MCP:

```
create_document kolu/brainstorming/pi-lanes.md            ← the thinking
add_node {"id":"kolu-pi-lanes","parent":..., 
          "desc":"see [pi-lanes](../brainstorming/pi-lanes.md)"}   ← what settled, beside it in kolu/
```

One repo, so doc + filings are ONE commit in the ledger; the doc's page lists the nodes that cite it (referrers), the nodes link back. Works identically for a repo you don't own (odu) — the brain never needed the code repo's permission.

## Multiple users, later

The vault already knows who is looking (the reverse-proxy identity: login, name, picture, per request). The orchestrator grows toward a team the same way:

```
lanes.olai:  {"id":"lane-...","props":{"repo":"...","owner":"srid","merge":"human:alice"}}
```

Needs-you becomes needs-*this*-you (the queue filtered by owner); a `#human` gate can name whose word it waits on. Nothing about the one-vault shape changes — a team orchestrator is the same vault with more identities acting on it.

## Rejected shapes, for the record

- **Per-project brain repos** (`kolu-brain`, …): composing them under one server fails at olai's one-repo commit gate — submodules leave inner writes uncommittable, symlinks add watcher unknowns, multi-root olai is a feature to build.
- **N olai servers**: rejected by the human ("lol").
- **GitHub wiki**: plan-gated on private repos, no advantage once the brain is its own repo.
- Escape hatch if a project's slice must ever leave: `git log -- <paths>` / `git filter-repo` carries its history out; nothing built until someone real needs it.

## Migration

1. `git init ~/brain`; from olai's `docs/`: `Inbox`, `Pins`, days, `_olai/Trash`, `orchestrator/` → the root; `roadmap/`, `brainstorming/`, `RCA/` → `olai/`.
2. Rewrite the ~26 cross-citations (engineering docs ↔ brainstorms) as cross-repo URLs; add the brain pointer to each repo's CLAUDE.md.
3. Point production olai at `~/brain`. Auto-push works unchanged.
4. New projects cost one folder: add `kolu/roadmap/features.olai` and kolu exists.

## Trade-offs

The brain is public, like today's vault — the move exposes nothing new. Write access is orchestrator membership: today that's you; the multi-user future above is what "sharing the kolu roadmap" actually becomes — a collaborator joins the orchestrator rather than receiving a directory. A genuinely private corner — not collaborators — is what would force a second, private vault.
