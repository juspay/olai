**IMPORTANT** This file is hand-maintained. AI must not edit it, unless to make corrections or updates to existing content.

- [Claude only] If your model is Fabel, when spawning sub-agents - use Fable only where truly necessary, and use Opus by default.
- Read `just --list` and the recipe's own comment before running a leg by hand: the justfile is where this repo's conventions live (e.g. `just test-log`, which says never to pipe a long run through `tail`/`head`).
- Keep docs up to date: website/ and docs/*.md — the engineering docs that change in the same PR as the code. 
