**IMPORTANT** This file is hand-maintained. AI must not edit it, unless to make corrections or updates to existing content.

- If your model is Fabel, when spawning sub-agents - use Fable only where truly necessary, and use Opus by default.

## PR workflow

- Keep docs up to date: README.md, docs/*.md — the engineering docs that change in the same PR as the code. Development docs — brainstorms, RCAs, roadmap, the board — live in https://github.com/juspay/oss.olai; file roadmap items via the olai MCP.
- CI, reviews, and merging are NOT the author's to run or commission — the dispatch brief that opened your session governs the process. Authors run LOCAL suites only: typecheck, unit, the touched features. CI = [odu SKILL.md](https://github.com/juspay/odu/blob/master/.apm/skills/odu/SKILL.md) (read in FULL) is the reference for whoever runs it: Linux; skip macOS unless the PR impacts macOS (this rule applies to all repos). Merge latest master into the PR only when the PR has conflicts (or CI needs code from master).

## PR evidence uploads

- Produce: write the throwaway section at `.saatchi/evidence.ts` and `nix run github:juspay/saatchi` (shots land in `.saatchi/shots/`). Upload: `nix run github:juspay/saatchi#publish` prints a paste-ready markdown block (videos handled, transcode included). Details in [saatchi's README](https://github.com/juspay/saatchi) — read it.
- Non-media artifacts or endpoint failure: Crabbox artifact publishing plus the manifest URL. Never push proof assets to any product repo branch; do not commit `.github/pr-assets`.
