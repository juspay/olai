**IMPORTANT** This file is hand-maintained. AI must not edit it, unless to make corrections or updates to existing content.

- If your model is Fabel, when spawning sub-agents - use Fable only where truly necessary, and use Opus by default.

## PR workflow

- Keep docs up to date: README.md, docs/*.md
- CI = [odu SKILL.md](https://github.com/juspay/odu/blob/master/.apm/skills/odu/SKILL.md) (read in FULL), Linux; skip macOS unless the PR impacts macOS (this rule applies to all repos). On the PR is ready: run CI to satisfy "CI green". Merge latest master into the PR only when the PR has conflicts (or CI needs code from master).
